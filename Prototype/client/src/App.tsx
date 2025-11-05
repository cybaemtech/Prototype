import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import CreatorDashboardWithAPI from "@/pages/CreatorDashboardWithAPI";
import ApproverDashboard from "@/pages/ApproverDashboard";
import IssuerDashboard from "@/pages/IssuerDashboard";
import RecipientDashboard from "@/pages/RecipientDashboard";
import CreateDocumentPage from "@/pages/CreateDocumentPage";
import AdminDashboard from "@/pages/AdminDashboard";
import NotificationPopup from "@/components/NotificationPopup";
import { Document } from "@/components/DocumentTable";

type UserRole = "Creator" | "Approver" | "Issuer" | "Recipient" | "Admin";

interface Activity {
  id: string;
  type: "created" | "approved" | "declined" | "issued" | "pending";
  docName: string;
  userName: string;
  timestamp: string;
  remarks?: string;
}

function Router() {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const handleLogin = async (data: { username: string; password: string }) => {
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        addNotification({
          type: "error",
          title: "Login Failed",
          message: error.message || "Invalid credentials. Please try again.",
        });
        return;
      }

      const user = await response.json();
      
      const roleMap: Record<string, UserRole> = {
        "creator": "Creator",
        "approver": "Approver",
        "issuer": "Issuer",
        "recipient": "Recipient",
        "admin": "Admin"
      };
      
      const role = roleMap[user.role] || "Recipient";
      
      setUserRole(role);
      setUserName(user.username);
      setUserId(user.id);
      setIsAuthenticated(true);

      // Navigate to appropriate dashboard
      switch (role) {
        case "Creator":
          setLocation("/creator");
          break;
        case "Approver":
          setLocation("/approver");
          break;
        case "Issuer":
          setLocation("/issuer");
          break;
        case "Recipient":
          setLocation("/recipient");
          break;
        case "Admin":
          setLocation("/admin");
          break;
      }

      // Show welcome notification
      addNotification({
        type: "success",
        title: "Login Successful",
        message: `Welcome back, ${user.fullName}!`,
      });
    } catch (error: any) {
      addNotification({
        type: "error",
        title: "Login Error",
        message: error.message || "An error occurred during login.",
      });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserName("");
    setUserId("");
    setDocuments([]);
    setActivities([]);
    setLocation("/");
    addNotification({
      type: "info",
      title: "Logged Out",
      message: "You have been successfully logged out.",
    });
  };

  const addNotification = (notif: {
    type: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
  }) => {
    const newNotif = {
      id: Date.now().toString(),
      ...notif,
    };
    setNotifications((prev) => [...prev, newNotif]);
  };

  const handleCreateDocument = () => {
    setLocation("/creator/create");
  };

  const handleDocumentSubmit = async (data: any) => {
    console.log("Document submitted:", data);
    
    try {
      if (!data.file) {
        addNotification({
          type: "error",
          title: "Error",
          message: "Word document file is required.",
        });
        return;
      }

      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('docName', data.docName);
      formData.append('docNumber', data.docNumber);
      formData.append('dateOfIssue', data.dateOfIssue ? new Date(data.dateOfIssue).toISOString() : new Date().toISOString());
      formData.append('revisionNo', (parseInt(data.revisionNumber) || 0).toString());
      formData.append('preparedBy', userId);
      formData.append('status', 'pending');
      if (data.preparerName) formData.append('preparerName', data.preparerName);
      if (data.reasonForRevision) formData.append('reasonForRevision', data.reasonForRevision);
      if (data.duePeriodYears) formData.append('duePeriodYears', data.duePeriodYears);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create document');
      }

      const createdDocument = await response.json();

      addNotification({
        type: "success",
        title: "Document Submitted",
        message: `${data.docName} has been submitted for approval. Header and footer extracted automatically.`,
      });

      setLocation("/creator");
    } catch (error: any) {
      console.error("Error submitting document:", error);
      addNotification({
        type: "error",
        title: "Error",
        message: error.message || "Failed to submit document. Please try again.",
      });
    }
  };

  const handleViewDocument = (doc: Document) => {
    console.log("Viewing document:", doc);
    addNotification({
      type: "info",
      title: "Document Opened",
      message: `Viewing ${doc.docName}`,
    });
  };

  const handleEditDocument = (docId: string, data: any) => {
    console.log("Editing document:", docId, data);
    
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              docName: data.docName,
              docNumber: data.docNumber,
              dateOfIssue: data.dateOfIssue,
              revisionNo: parseInt(data.revisionNumber) || 0,
              preparedBy: data.preparerName,
            }
          : doc
      )
    );

    // Add activity
    const document = documents.find(d => d.id === docId);
    if (document) {
      const newActivity: Activity = {
        id: Date.now().toString(),
        type: "created",
        docName: data.docName,
        userName: "You",
        timestamp: "Just now",
      };
      setActivities((prev) => [newActivity, ...prev]);
    }

    addNotification({
      type: "success",
      title: "Document Updated",
      message: `${data.docName} has been updated successfully.`,
    });
  };

  const handleDeleteDocument = (docId: string) => {
    const document = documents.find(d => d.id === docId);
    
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId));

    if (document) {
      addNotification({
        type: "info",
        title: "Document Deleted",
        message: `${document.docName} has been deleted.`,
      });
    }
  };

  const handleDownloadDocument = (doc: Document) => {
    console.log("Downloading document:", doc);
    addNotification({
      type: "success",
      title: "Download Started",
      message: `Downloading ${doc.docName}...`,
    });
  };

  return (
    <>
      <Switch>
        <Route path="/" component={() => <LoginPage onLogin={handleLogin} />} />
        <Route
          path="/creator"
          component={() => (
            <CreatorDashboardWithAPI
              onCreateDocument={handleCreateDocument}
              onLogout={handleLogout}
              userId={userId}
              userName={userName}
            />
          )}
        />
        <Route
          path="/creator/create"
          component={() => (
            <CreateDocumentPage
              onBack={() => setLocation("/creator")}
              onSubmit={handleDocumentSubmit}
              onLogout={handleLogout}
              userName={userName}
            />
          )}
        />
        <Route path="/approver" component={() => <ApproverDashboard onLogout={handleLogout} userId={userId} />} />
        <Route path="/issuer" component={() => <IssuerDashboard onLogout={handleLogout} userId={userId} />} />
        <Route path="/recipient" component={() => <RecipientDashboard onLogout={handleLogout} userId={userId} />} />
        <Route path="/admin" component={() => <AdminDashboard onLogout={handleLogout} userId={userId} />} />
        <Route component={NotFound} />
      </Switch>

      {notifications.map((notif) => (
        <NotificationPopup
          key={notif.id}
          notification={notif}
          onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
        />
      ))}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
