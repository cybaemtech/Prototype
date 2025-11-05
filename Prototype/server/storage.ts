import fs from "fs/promises";
import path from "path";
import { 
  type User, 
  type InsertUser, 
  type Document,
  type InsertDocument,
  type Department,
  type InsertDepartment,
  type Notification,
  type InsertNotification,
  type ControlCopy,
  type InsertControlCopy,
  type PrintLog,
  type InsertPrintLog,
  type DocumentRecipient,
  type InsertDocumentRecipient
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByStatus(status: string, userId?: string): Promise<Document[]>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  
  getDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  
  assignDocumentToDepartments(documentId: string, departmentIds: string[]): Promise<void>;
  getDocumentDepartments(documentId: string): Promise<Department[]>;
  
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<void>;
  
  getUsersByRole(role: string): Promise<User[]>;
  
  createControlCopy(controlCopy: Omit<InsertControlCopy, 'copyNumber'>): Promise<ControlCopy>;
  getControlCopiesByDocument(documentId: string): Promise<ControlCopy[]>;
  getControlCopiesByUser(userId: string): Promise<ControlCopy[]>;
  
  createPrintLog(printLog: InsertPrintLog): Promise<PrintLog>;
  getPrintLogsByDocument(documentId: string): Promise<PrintLog[]>;
  getPrintLogsByUser(userId: string): Promise<PrintLog[]>;
  
  createDocumentRecipient(recipient: InsertDocumentRecipient): Promise<DocumentRecipient>;
  getDocumentRecipients(documentId: string): Promise<DocumentRecipient[]>;
  getUserAccessibleDocuments(userId: string): Promise<Document[]>;
}

interface JsonData {
  users: User[];
  documents: Document[];
  departments: Department[];
  notifications: Notification[];
  documentDepartments: Array<{ documentId: string; departmentId: string }>;
  controlCopies: ControlCopy[];
  printLogs: PrintLog[];
  documentRecipients: DocumentRecipient[];
}

export class JsonStorage implements IStorage {
  private dataPath = path.join(process.cwd(), "data.json");
  private data: JsonData = {
    users: [],
    documents: [],
    departments: [],
    notifications: [],
    documentDepartments: [],
    controlCopies: [],
    printLogs: [],
    documentRecipients: []
  };
  private ready: Promise<void>;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.ready = this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.dataPath, "utf-8");
      this.data = JSON.parse(fileContent);
    } catch (error) {
      await this.initializeData();
    }
  }

  private async initializeData(): Promise<void> {
    this.data = {
      users: [
        {
          id: "creator-1",
          username: "Priyanka.k@cybaemtech.com",
          password: "123",
          role: "creator",
          fullName: "Priyanka K",
          masterCopyAccess: false
        },
        {
          id: "approver-1",
          username: "approver@cybaem.com",
          password: "123",
          role: "approver",
          fullName: "John Approver",
          masterCopyAccess: false
        },
        {
          id: "issuer-1",
          username: "issuer@cybaem.com",
          password: "123",
          role: "issuer",
          fullName: "Jane Issuer",
          masterCopyAccess: true
        },
        {
          id: "admin-1",
          username: "admin@cybaem.com",
          password: "123",
          role: "admin",
          fullName: "Admin User",
          masterCopyAccess: true
        }
      ],
      departments: [
        { id: "dept-1", name: "Engineering", code: "ENG", createdAt: new Date() },
        { id: "dept-2", name: "Quality Assurance", code: "QA", createdAt: new Date() },
        { id: "dept-3", name: "Operations", code: "OPS", createdAt: new Date() },
        { id: "dept-4", name: "Finance", code: "FIN", createdAt: new Date() },
        { id: "dept-5", name: "Human Resources", code: "HR", createdAt: new Date() }
      ],
      documents: [],
      notifications: [],
      documentDepartments: [],
      controlCopies: [],
      printLogs: [],
      documentRecipients: []
    };
    await this.saveData();
  }

  private async saveData(): Promise<void> {
    this.saveQueue = this.saveQueue.then(async () => {
      await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
    });
    await this.saveQueue;
  }

  async getUser(id: string): Promise<User | undefined> {
    await this.ready;
    return this.data.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.ready;
    return this.data.users.find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ready;
    const user: User = {
      id: `user-${Date.now()}`,
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role || "creator",
      fullName: insertUser.fullName,
      masterCopyAccess: insertUser.masterCopyAccess ?? false
    };
    this.data.users.push(user);
    await this.saveData();
    return user;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    await this.ready;
    return this.data.documents.find(d => d.id === id);
  }

  async getDocumentsByStatus(status: string): Promise<Document[]> {
    await this.ready;
    return this.data.documents
      .filter(d => d.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    await this.ready;
    return this.data.documents
      .filter(d => d.preparedBy === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    await this.ready;
    const doc: Document = {
      id: `doc-${Date.now()}`,
      docName: insertDocument.docName,
      docNumber: insertDocument.docNumber,
      status: "pending",
      dateOfIssue: insertDocument.dateOfIssue || null,
      revisionNo: insertDocument.revisionNo || 0,
      preparedBy: insertDocument.preparedBy,
      approvedBy: null,
      issuedBy: null,
      content: insertDocument.content || null,
      headerInfo: insertDocument.headerInfo || null,
      footerInfo: insertDocument.footerInfo || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedAt: null,
      issuedAt: null,
      approvalRemarks: insertDocument.approvalRemarks || null,
      declineRemarks: insertDocument.declineRemarks || null,
      issueRemarks: null,
      issuerName: null,
      previousVersionId: insertDocument.previousVersionId || null,
      pdfFilePath: null,
      wordFilePath: null
    };
    this.data.documents.push(doc);
    await this.saveData();
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    await this.ready;
    const index = this.data.documents.findIndex(d => d.id === id);
    if (index === -1) return undefined;
    
    this.data.documents[index] = {
      ...this.data.documents[index],
      ...updates,
      updatedAt: new Date()
    };
    await this.saveData();
    return this.data.documents[index];
  }

  async getDepartments(): Promise<Department[]> {
    await this.ready;
    return this.data.departments;
  }

  async createDepartment(insertDepartment: InsertDepartment): Promise<Department> {
    await this.ready;
    const dept: Department = {
      ...insertDepartment,
      id: `dept-${Date.now()}`,
      createdAt: new Date()
    };
    this.data.departments.push(dept);
    await this.saveData();
    return dept;
  }

  async assignDocumentToDepartments(documentId: string, departmentIds: string[]): Promise<void> {
    await this.ready;
    this.data.documentDepartments = this.data.documentDepartments.filter(
      dd => dd.documentId !== documentId
    );
    
    for (const deptId of departmentIds) {
      this.data.documentDepartments.push({ documentId, departmentId: deptId });
    }
    
    await this.saveData();
  }

  async getDocumentDepartments(documentId: string): Promise<Department[]> {
    await this.ready;
    const deptIds = this.data.documentDepartments
      .filter(dd => dd.documentId === documentId)
      .map(dd => dd.departmentId);
    
    return this.data.departments.filter(d => deptIds.includes(d.id));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    await this.ready;
    const notification: Notification = {
      ...insertNotification,
      id: `notif-${Date.now()}-${Math.random()}`,
      isRead: false,
      createdAt: new Date()
    };
    this.data.notifications.push(notification);
    await this.saveData();
    return notification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    await this.ready;
    return this.data.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.ready;
    const notification = this.data.notifications.find(n => n.id === id);
    if (notification) {
      notification.isRead = true;
      await this.saveData();
    }
  }

  async getUsersByRole(role: string): Promise<User[]> {
    await this.ready;
    return this.data.users.filter(u => u.role === role);
  }

  async createControlCopy(insertControlCopy: Omit<InsertControlCopy, 'copyNumber'>): Promise<ControlCopy> {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      this.saveQueue = this.saveQueue.then(async () => {
        try {
          const copyNumber = await this.getNextCopyNumber(insertControlCopy.documentId, insertControlCopy.userId);
          const controlCopy: ControlCopy = {
            id: `cc-${Date.now()}-${Math.random()}`,
            documentId: insertControlCopy.documentId,
            userId: insertControlCopy.userId,
            actionType: insertControlCopy.actionType,
            copyNumber,
            generatedAt: new Date()
          };
          this.data.controlCopies.push(controlCopy);
          await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
          resolve(controlCopy);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async getControlCopiesByDocument(documentId: string): Promise<ControlCopy[]> {
    await this.ready;
    return this.data.controlCopies
      .filter(cc => cc.documentId === documentId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getControlCopiesByUser(userId: string): Promise<ControlCopy[]> {
    await this.ready;
    return this.data.controlCopies
      .filter(cc => cc.userId === userId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getNextCopyNumber(documentId: string, userId: string): Promise<number> {
    await this.ready;
    const userCopies = this.data.controlCopies.filter(
      cc => cc.documentId === documentId && cc.userId === userId
    );
    if (userCopies.length === 0) return 1;
    return Math.max(...userCopies.map(cc => cc.copyNumber)) + 1;
  }

  async createPrintLog(insertPrintLog: InsertPrintLog): Promise<PrintLog> {
    await this.ready;
    const printLog: PrintLog = {
      id: `pl-${Date.now()}-${Math.random()}`,
      documentId: insertPrintLog.documentId,
      userId: insertPrintLog.userId,
      controlCopyId: insertPrintLog.controlCopyId,
      medium: insertPrintLog.medium || null,
      printedAt: new Date()
    };
    this.data.printLogs.push(printLog);
    await this.saveData();
    return printLog;
  }

  async getPrintLogsByDocument(documentId: string): Promise<PrintLog[]> {
    await this.ready;
    return this.data.printLogs
      .filter(pl => pl.documentId === documentId)
      .sort((a, b) => new Date(b.printedAt).getTime() - new Date(a.printedAt).getTime());
  }

  async getPrintLogsByUser(userId: string): Promise<PrintLog[]> {
    await this.ready;
    return this.data.printLogs
      .filter(pl => pl.userId === userId)
      .sort((a, b) => new Date(b.printedAt).getTime() - new Date(a.printedAt).getTime());
  }

  async createDocumentRecipient(insertRecipient: InsertDocumentRecipient): Promise<DocumentRecipient> {
    await this.ready;
    
    if (!insertRecipient.userId && !insertRecipient.departmentId) {
      throw new Error("Document recipient must have either userId or departmentId");
    }
    
    const recipient: DocumentRecipient = {
      id: `dr-${Date.now()}-${Math.random()}`,
      documentId: insertRecipient.documentId,
      userId: insertRecipient.userId || null,
      departmentId: insertRecipient.departmentId || null,
      notifiedAt: new Date(),
      readAt: null
    };
    this.data.documentRecipients.push(recipient);
    await this.saveData();
    return recipient;
  }

  async getDocumentRecipients(documentId: string): Promise<DocumentRecipient[]> {
    await this.ready;
    return this.data.documentRecipients.filter(dr => dr.documentId === documentId);
  }

  async getUserAccessibleDocuments(userId: string): Promise<Document[]> {
    await this.ready;
    const accessibleDocIds = this.data.documentRecipients
      .filter(dr => dr.userId === userId)
      .map(dr => dr.documentId);
    
    return this.data.documents.filter(d => accessibleDocIds.includes(d.id) && d.status === 'issued');
  }
}

export const storage = new JsonStorage();
