import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { pdfService } from "./services/pdf-service";
import fs from "fs/promises";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  const upload = multer({ storage: multer.memoryStorage() });
  
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/documents", async (req, res) => {
    try {
      const { status, userId } = req.query;
      let documents;
      
      if (status) {
        documents = await storage.getDocumentsByStatus(status as string);
      } else if (userId) {
        documents = await storage.getDocumentsByUser(userId as string);
      } else {
        return res.status(400).json({ message: "Status or userId query parameter is required" });
      }
      
      const documentsWithDetails = await Promise.all(
        documents.map(async (doc) => {
          const preparer = await storage.getUser(doc.preparedBy);
          const approver = doc.approvedBy ? await storage.getUser(doc.approvedBy) : null;
          const issuer = doc.issuedBy ? await storage.getUser(doc.issuedBy) : null;
          const depts = await storage.getDocumentDepartments(doc.id);
          
          return {
            ...doc,
            preparerName: preparer?.fullName || "Unknown",
            approverName: approver?.fullName || null,
            issuerName: issuer?.fullName || null,
            departments: depts
          };
        })
      );
      
      res.json(documentsWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/due-for-review", async (req, res) => {
    try {
      const { daysAhead = '30' } = req.query;
      const daysAheadInt = parseInt(daysAhead as string, 10);
      
      if (isNaN(daysAheadInt) || daysAheadInt < 0) {
        return res.status(400).json({ message: "Invalid daysAhead parameter" });
      }
      
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAheadInt);
      
      const issuedDocs = await storage.getDocumentsByStatus("issued");
      
      const dueForReview = issuedDocs.filter(doc => {
        if (!doc.reviewDueDate) return false;
        const dueDate = new Date(doc.reviewDueDate);
        return dueDate <= futureDate;
      });
      
      const documentsWithDetails = await Promise.all(
        dueForReview.map(async (doc) => {
          const preparer = await storage.getUser(doc.preparedBy);
          const depts = await storage.getDocumentDepartments(doc.id);
          const daysUntilDue = Math.ceil((new Date(doc.reviewDueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            ...doc,
            preparerName: preparer?.fullName || "Unknown",
            departments: depts,
            daysUntilDue
          };
        })
      );
      
      documentsWithDetails.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
      
      res.json(documentsWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const preparer = await storage.getUser(document.preparedBy);
      const approver = document.approvedBy ? await storage.getUser(document.approvedBy) : null;
      const issuer = document.issuedBy ? await storage.getUser(document.issuedBy) : null;
      const depts = await storage.getDocumentDepartments(document.id);
      const previousVersion = document.previousVersionId 
        ? await storage.getDocument(document.previousVersionId) 
        : null;
      
      res.json({
        ...document,
        preparerName: preparer?.fullName || "Unknown",
        approverName: approver?.fullName || null,
        issuerName: issuer?.fullName || null,
        departments: depts,
        previousVersion
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Word document file is required" });
      }

      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Only Word documents (.doc, .docx) are allowed" });
      }

      const maxSize = 10 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: "File size must be less than 10MB" });
      }

      const extracted = await pdfService.extractHeaderFooterFromWord(req.file.buffer);

      const duePeriodYears = req.body.duePeriodYears ? parseInt(req.body.duePeriodYears, 10) : undefined;
      const dateOfIssue = req.body.dateOfIssue ? new Date(req.body.dateOfIssue) : new Date();
      
      let reviewDueDate = undefined;
      if (duePeriodYears && duePeriodYears > 0) {
        reviewDueDate = new Date(dateOfIssue);
        reviewDueDate.setFullYear(reviewDueDate.getFullYear() + duePeriodYears);
      }

      const documentData = {
        ...req.body,
        revisionNo: req.body.revisionNo ? parseInt(req.body.revisionNo, 10) : 0,
        duePeriodYears,
        reasonForRevision: req.body.reasonForRevision || undefined,
        dateOfIssue,
        reviewDueDate,
        headerInfo: extracted.headerInfo,
        footerInfo: extracted.footerInfo
      };
      
      const document = await storage.createDocument(documentData);
      
      const filePath = await pdfService.saveUploadedFile(
        req.file.buffer,
        req.file.originalname,
        document.id
      );
      
      await storage.updateDocument(document.id, { wordFilePath: filePath });
      
      const approvers = await storage.getUsersByRole("approver");
      for (const approver of approvers) {
        await storage.createNotification({
          userId: approver.id,
          documentId: document.id,
          message: `New document "${document.docName}" (${document.docNumber}) is ready for your approval`,
          type: "new_document"
        });
      }
      
      res.status(201).json({ ...document, wordFilePath: filePath });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/approve", async (req, res) => {
    try {
      const { approvalRemarks, approvedBy, approverName, departments } = req.body;
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const approver = await storage.getUser(approvedBy);
      const finalApproverName = approverName || approver?.fullName || "Unknown";
      
      const updatedDoc = await storage.updateDocument(req.params.id, {
        status: "approved",
        approvalRemarks,
        approvedBy,
        approvedAt: new Date()
      });
      
      if (departments && departments.length > 0) {
        await storage.assignDocumentToDepartments(req.params.id, departments);
      }
      
      const issuers = await storage.getUsersByRole("issuer");
      for (const issuer of issuers) {
        await storage.createNotification({
          userId: issuer.id,
          documentId: req.params.id,
          message: `Document "${document.docName}" (${document.docNumber}) has been approved by ${finalApproverName}. Remarks: "${approvalRemarks}"`,
          type: "approved_document"
        });
      }
      
      await storage.createNotification({
        userId: document.preparedBy,
        documentId: req.params.id,
        message: `Your document "${document.docName}" (${document.docNumber}) has been approved by ${finalApproverName}`,
        type: "document_status_update"
      });
      
      res.json(updatedDoc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/decline", async (req, res) => {
    try {
      const { declineRemarks } = req.body;
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const updatedDoc = await storage.updateDocument(req.params.id, {
        status: "declined",
        declineRemarks,
        approvedBy: null,
        issuedBy: null
      });
      
      await storage.createNotification({
        userId: document.preparedBy,
        documentId: req.params.id,
        message: `Your document "${document.docName}" (${document.docNumber}) has been declined by issuer. Remarks: ${declineRemarks}. Please review and resubmit.`,
        type: "document_declined"
      });
      
      res.json(updatedDoc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/issue", async (req, res) => {
    try {
      const { issuedBy, issuerName, remarks } = req.body;
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const updatedDoc = await storage.updateDocument(req.params.id, {
        status: "issued",
        issuedBy,
        issuerName,
        issueRemarks: remarks,
        issuedAt: new Date()
      });
      
      await storage.createNotification({
        userId: document.preparedBy,
        documentId: req.params.id,
        message: `Your document "${document.docName}" (${document.docNumber}) has been issued by ${issuerName}`,
        type: "document_issued"
      });
      
      if (document.approvedBy) {
        await storage.createNotification({
          userId: document.approvedBy,
          documentId: req.params.id,
          message: `Document "${document.docName}" (${document.docNumber}) has been issued`,
          type: "document_issued"
        });
      }
      
      res.json(updatedDoc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.params.userId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/departments", async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const department = await storage.createDepartment(req.body);
      res.status(201).json(department);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const { role } = req.query;
      if (role) {
        const users = await storage.getUsersByRole(role as string);
        res.json(users);
      } else {
        res.status(400).json({ message: "Role query parameter is required" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const filePath = await pdfService.saveUploadedFile(
        req.file.buffer,
        req.file.originalname,
        req.params.id
      );

      const updatedDoc = await storage.updateDocument(req.params.id, {
        wordFilePath: filePath
      });

      res.json({ message: "File uploaded successfully", document: updatedDoc });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.wordFilePath) {
        return res.status(404).json({ message: "No Word file available for this document" });
      }

      const path = await import("path");
      const fs = await import("fs/promises");
      
      try {
        await fs.access(document.wordFilePath);
        const fileName = path.basename(document.wordFilePath);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        const fileBuffer = await fs.readFile(document.wordFilePath);
        res.send(fileBuffer);
      } catch (err) {
        return res.status(404).json({ message: "Word file not found on server" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/view-word", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.wordFilePath) {
        return res.status(404).json({ message: "No Word file available for this document" });
      }

      try {
        await fs.access(document.wordFilePath);
        const wordBuffer = await fs.readFile(document.wordFilePath);
        
        const mammoth = await import("mammoth");
        const result = await mammoth.default.convertToHtml({ buffer: wordBuffer });
        
        res.json({
          html: result.value,
          messages: result.messages,
          docName: document.docName,
          docNumber: document.docNumber,
          revisionNo: document.revisionNo
        });
      } catch (err) {
        return res.status(404).json({ message: "Word file not found on server" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/:id/pdf", async (req, res) => {
    try {
      const { userId, version } = req.query;
      
      if (!userId) {
        return res.status(400).json({ message: "userId query parameter is required" });
      }

      const user = await storage.getUser(userId as string);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const originalDocNumber = document.docNumber;
      const allIssuedDocs = await storage.getDocumentsByStatus("issued");
      const allVersions = allIssuedDocs.filter(d => d.docNumber === originalDocNumber);

      if (allVersions.length === 0) {
        return res.status(404).json({ message: "No issued versions found for this document" });
      }

      const latestVersion = allVersions.reduce((latest, current) => {
        return current.revisionNo > latest.revisionNo ? current : latest;
      }, allVersions[0]);

      if (version !== undefined) {
        const requestedVersion = parseInt(version as string, 10);
        if (isNaN(requestedVersion)) {
          return res.status(400).json({ message: "Invalid version parameter" });
        }

        if (!user.masterCopyAccess) {
          return res.status(403).json({ 
            message: "Access denied. Only master copy users can access specific versions." 
          });
        }

        const requestedDoc = allVersions.find(d => d.revisionNo === requestedVersion);
        if (!requestedDoc) {
          return res.status(404).json({ message: `Version ${requestedVersion} not found` });
        }

        document = await storage.getDocument(requestedDoc.id) || requestedDoc;
      } else if (!user.masterCopyAccess && document.id !== latestVersion.id) {
        return res.status(403).json({ 
          message: "Access denied. Only the latest version can be accessed. Please contact administrator for previous versions." 
        });
      }

      if (document.status !== "issued") {
        return res.status(403).json({ message: "Only issued documents can be viewed as PDF" });
      }

      if (!document.wordFilePath) {
        return res.status(404).json({ message: "No Word file uploaded for this document" });
      }

      const controlCopy = await storage.createControlCopy({
        documentId: document.id,
        userId: userId as string,
        actionType: "view"
      });

      const controlCopyInfo = {
        userId: user.id,
        userFullName: user.fullName,
        controlCopyNumber: controlCopy.copyNumber,
        date: new Date().toLocaleDateString()
      };

      const pdfPath = await pdfService.convertWordToPDF(
        document.wordFilePath,
        document,
        controlCopyInfo
      );

      const pdfBuffer = await fs.readFile(pdfPath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents/:id/print", async (req, res) => {
    try {
      const { userId, version } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const originalDocNumber = document.docNumber;
      const allIssuedDocs = await storage.getDocumentsByStatus("issued");
      const allVersions = allIssuedDocs.filter(d => d.docNumber === originalDocNumber);

      if (allVersions.length === 0) {
        return res.status(404).json({ message: "No issued versions found for this document" });
      }

      const latestVersion = allVersions.reduce((latest, current) => {
        return current.revisionNo > latest.revisionNo ? current : latest;
      }, allVersions[0]);

      if (version !== undefined) {
        const requestedVersion = parseInt(version as string, 10);
        if (isNaN(requestedVersion)) {
          return res.status(400).json({ message: "Invalid version parameter" });
        }

        if (!user.masterCopyAccess) {
          return res.status(403).json({ 
            message: "Access denied. Only master copy users can print specific versions." 
          });
        }

        const requestedDoc = allVersions.find(d => d.revisionNo === requestedVersion);
        if (!requestedDoc) {
          return res.status(404).json({ message: `Version ${requestedVersion} not found` });
        }

        document = await storage.getDocument(requestedDoc.id) || requestedDoc;
      } else if (!user.masterCopyAccess && document.id !== latestVersion.id) {
        return res.status(403).json({ 
          message: "Access denied. Only the latest version can be printed. Please contact administrator for previous versions." 
        });
      }

      if (document.status !== "issued") {
        return res.status(403).json({ message: "Only issued documents can be printed" });
      }

      if (!document.wordFilePath) {
        return res.status(404).json({ message: "No Word file uploaded for this document" });
      }

      const controlCopy = await storage.createControlCopy({
        documentId: document.id,
        userId: userId,
        actionType: "print"
      });

      const printLog = await storage.createPrintLog({
        documentId: document.id,
        userId: userId,
        controlCopyId: controlCopy.id,
        medium: "PDF"
      });

      const controlCopyInfo = {
        userId: user.id,
        userFullName: user.fullName,
        controlCopyNumber: controlCopy.copyNumber,
        date: new Date().toLocaleDateString()
      };

      const pdfPath = await pdfService.convertWordToPDF(
        document.wordFilePath,
        document,
        controlCopyInfo
      );

      const pdfBuffer = await fs.readFile(pdfPath);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/print-logs", async (req, res) => {
    try {
      const { documentId, userId } = req.query;
      
      let printLogs;
      if (documentId) {
        printLogs = await storage.getPrintLogsByDocument(documentId as string);
      } else if (userId) {
        printLogs = await storage.getPrintLogsByUser(userId as string);
      } else {
        return res.status(400).json({ message: "documentId or userId query parameter is required" });
      }

      const logsWithDetails = await Promise.all(
        printLogs.map(async (log) => {
          const document = await storage.getDocument(log.documentId);
          const user = await storage.getUser(log.userId);
          const controlCopy = await storage.getControlCopiesByDocument(log.documentId);
          const userCopy = controlCopy.find(cc => cc.id === log.controlCopyId);

          return {
            ...log,
            documentName: document?.docName || "Unknown",
            documentNumber: document?.docNumber || "Unknown",
            userName: user?.fullName || "Unknown",
            userEmail: user?.username || "Unknown",
            controlCopyNumber: userCopy?.copyNumber || 0,
          };
        })
      );

      res.json(logsWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/:docNumber/versions", async (req, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ message: "userId query parameter is required" });
      }

      const user = await storage.getUser(userId as string);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const allDocuments = await storage.getDocumentsByStatus("issued");
      const documentVersions = allDocuments.filter(d => d.docNumber === req.params.docNumber);

      if (user.masterCopyAccess) {
        res.json(documentVersions);
      } else {
        const latestVersion = documentVersions.reduce((latest, current) => {
          return current.revisionNo > latest.revisionNo ? current : latest;
        }, documentVersions[0]);
        res.json([latestVersion]);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
