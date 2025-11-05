import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import DocumentTable, { Document } from "@/components/DocumentTable";
import ActivityFeed from "@/components/ActivityFeed";
import DocumentViewDialog from "@/components/DocumentViewDialog";
import DocumentEditDialog from "@/components/DocumentEditDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import ReviewReminders from "@/components/ReviewReminders";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock, CheckCircle, XCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocumentStatus } from "@/components/StatusBadge";

interface CreatorDashboardProps {
  onCreateDocument?: () => void;
  onLogout?: () => void;
  userId?: string;
  userName?: string;
}

interface ApiDocument {
  id: string;
  docName: string;
  docNumber: string;
  status: string;
  dateOfIssue: string;
  revisionNo: number;
  preparedBy: string;
  preparerName?: string;
  approverName?: string;
  issuerName?: string;
  departments?: Array<{ id: string; name: string }>;
  content?: string;
  headerInfo?: string;
  footerInfo?: string;
  approvalRemarks?: string;
  declineRemarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Activity {
  id: string;
  type: "created" | "approved" | "declined" | "issued" | "pending";
  docName: string;
  userName: string;
  timestamp: string;
  remarks?: string;
}

interface Notification {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function CreatorDashboardWithAPI({ 
  onCreateDocument, 
  onLogout,
  userId = "creator-1",
  userName = "Creator User"
}: CreatorDashboardProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ApiDocument | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: myDocuments = [], isLoading } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents", userId],
    queryFn: async () => {
      const response = await fetch(`/api/documents?userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
    refetchInterval: 5000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", userId],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", userId] });
      toast({
        title: "Document Deleted",
        description: "The document has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const pendingDocs = myDocuments.filter(doc => doc.status === "pending");
  const approvedDocs = myDocuments.filter(doc => doc.status === "approved");
  const declinedDocs = myDocuments.filter(doc => doc.status === "declined");
  const issuedDocs = myDocuments.filter(doc => doc.status === "issued");
  const unreadNotifications = notifications.filter(n => !n.isRead).length;

  const handleView = (doc: Document) => {
    setViewDoc(doc);
    setViewDialogOpen(true);
  };

  const handleEdit = (doc: Document) => {
    const fullDoc = myDocuments.find(d => d.id === doc.id);
    if (fullDoc) {
      setSelectedDoc(fullDoc);
      setEditDialogOpen(true);
    }
  };

  const handleDelete = (doc: Document) => {
    const fullDoc = myDocuments.find(d => d.id === doc.id);
    if (fullDoc) {
      setSelectedDoc(fullDoc);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (selectedDoc) {
      deleteMutation.mutate(selectedDoc.id);
      setDeleteDialogOpen(false);
      setSelectedDoc(null);
    }
  };

  const handleSaveEdit = (docId: string, data: any) => {
    console.log("Editing document:", docId, data);
    setEditDialogOpen(false);
    setSelectedDoc(null);
    toast({
      title: "Document Updated",
      description: "Your changes have been saved successfully.",
    });
  };

  const handleDownload = (doc: Document) => {
    toast({
      title: "Download Started",
      description: `Downloading ${doc.docName}...`,
    });
  };

  const transformedDocs = (docs: ApiDocument[]): Document[] => {
    return docs.map(doc => ({
      id: doc.id,
      docName: doc.docName,
      docNumber: doc.docNumber,
      status: (doc.status.charAt(0).toUpperCase() + doc.status.slice(1)) as DocumentStatus,
      dateOfIssue: doc.dateOfIssue ? new Date(doc.dateOfIssue).toISOString().split('T')[0] : '',
      revisionNo: doc.revisionNo,
      preparedBy: doc.preparerName || 'Unknown',
    }));
  };

  const activities: Activity[] = myDocuments.slice(0, 5).map(doc => ({
    id: doc.id,
    type: doc.status === "pending" ? "pending" : 
          doc.status === "approved" ? "approved" : 
          doc.status === "declined" ? "declined" : 
          doc.status === "issued" ? "issued" : "created",
    docName: doc.docName,
    userName: doc.preparerName || userName,
    timestamp: doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "Unknown",
    remarks: doc.approvalRemarks || doc.declineRemarks
  }));

  return (
    <DashboardLayout
      userRole="Document Creator"
      userName={userName}
      userId={userId}
      notificationCount={unreadNotifications}
      onLogout={onLogout}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-foreground">My Documents</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage your documents
            </p>
          </div>
          <Button onClick={onCreateDocument} data-testid="button-create-document">
            <Plus className="w-4 h-4 mr-2" />
            Create Document
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Documents"
            value={myDocuments.length}
            icon={FileText}
            trend="Created by you"
          />
          <StatCard 
            title="Pending Review" 
            value={pendingDocs.length} 
            icon={Clock} 
            trend="Awaiting approval" 
          />
          <StatCard 
            title="Approved" 
            value={approvedDocs.length} 
            icon={CheckCircle} 
            trend="Ready for issue" 
          />
          <StatCard 
            title="Declined" 
            value={declinedDocs.length} 
            icon={XCircle} 
            trend="Requires revision" 
          />
        </div>

        <ReviewReminders daysAhead={60} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="pending" className="space-y-4">
              <TabsList>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({pendingDocs.length})
                </TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">
                  Approved ({approvedDocs.length})
                </TabsTrigger>
                <TabsTrigger value="declined" data-testid="tab-declined">
                  Declined ({declinedDocs.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {isLoading ? (
                  <div className="border rounded-lg p-12 text-center">
                    <p className="text-sm text-muted-foreground">Loading documents...</p>
                  </div>
                ) : pendingDocs.length > 0 ? (
                  <DocumentTable
                    documents={transformedDocs(pendingDocs)}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    canEdit={true}
                    canDelete={true}
                  />
                ) : (
                  <div className="border rounded-lg p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">No pending documents</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approved">
                {approvedDocs.length > 0 ? (
                  <DocumentTable
                    documents={transformedDocs(approvedDocs)}
                    onView={handleView}
                    onDownload={handleDownload}
                  />
                ) : (
                  <div className="border rounded-lg p-12 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">No approved documents</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="declined">
                {declinedDocs.length > 0 ? (
                  <DocumentTable
                    documents={transformedDocs(declinedDocs)}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    canEdit={true}
                    canDelete={true}
                  />
                ) : (
                  <div className="border rounded-lg p-12 text-center">
                    <XCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">No declined documents</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <ActivityFeed activities={activities} maxItems={5} />
          </div>
        </div>
      </div>

      <DocumentViewDialog
        document={viewDoc}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        onDownload={handleDownload}
      />

      <DocumentEditDialog
        document={selectedDoc ? {
          id: selectedDoc.id,
          docName: selectedDoc.docName,
          docNumber: selectedDoc.docNumber,
          status: (selectedDoc.status.charAt(0).toUpperCase() + selectedDoc.status.slice(1)) as DocumentStatus,
          dateOfIssue: selectedDoc.dateOfIssue ? new Date(selectedDoc.dateOfIssue).toISOString().split('T')[0] : '',
          revisionNo: selectedDoc.revisionNo,
          preparedBy: selectedDoc.preparerName || 'Unknown',
        } : null}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveEdit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Document"
        description={`Are you sure you want to delete "${selectedDoc?.docName}"? This action cannot be undone.`}
      />
    </DashboardLayout>
  );
}
