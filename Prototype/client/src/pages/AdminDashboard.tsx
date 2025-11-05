import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import DocumentTable, { Document } from "@/components/DocumentTable";
import DocumentViewDialog from "@/components/DocumentViewDialog";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Users, Building2, CheckCircle, Clock, XCircle, Send, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminDashboardProps {
  onLogout?: () => void;
  userId?: string;
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
  previousVersionId?: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function AdminDashboard({ onLogout, userId = "admin-1" }: AdminDashboardProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const { toast } = useToast();

  const { data: allDocuments = [], isLoading } = useQuery<ApiDocument[]>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const response = await fetch("/api/documents");
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
    refetchInterval: 5000,
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const response = await fetch("/api/departments");
      if (!response.ok) throw new Error("Failed to fetch departments");
      return response.json();
    },
  });

  const handleView = (doc: Document) => {
    setSelectedDoc(doc);
    setViewDialogOpen(true);
  };

  const handleExportLogs = () => {
    toast({
      title: "Export to Excel",
      description: "Document logs export feature will be implemented soon.",
    });
  };

  const transformDocuments = (docs: ApiDocument[]): Document[] => {
    return docs.map((doc) => ({
      id: doc.id,
      docName: doc.docName,
      docNumber: doc.docNumber,
      status: doc.status.charAt(0).toUpperCase() + doc.status.slice(1) as any,
      dateOfIssue: doc.dateOfIssue ? new Date(doc.dateOfIssue).toISOString().split("T")[0] : "",
      revisionNo: doc.revisionNo,
      preparedBy: doc.preparerName || "Unknown",
    }));
  };

  const pendingDocs = allDocuments.filter(d => d.status === "pending");
  const approvedDocs = allDocuments.filter(d => d.status === "approved");
  const issuedDocs = allDocuments.filter(d => d.status === "issued");
  const declinedDocs = allDocuments.filter(d => d.status === "declined");

  return (
    <DashboardLayout
      userRole="Administrator"
      userName="Admin User"
      userId={userId}
      notificationCount={0}
      onLogout={onLogout}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">Administrator Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Complete system oversight and management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Documents"
            value={allDocuments.length}
            icon={FileText}
            trend="All documents"
          />
          <StatCard
            title="Pending Approval"
            value={pendingDocs.length}
            icon={Clock}
            trend="Awaiting review"
          />
          <StatCard
            title="Issued"
            value={issuedDocs.length}
            icon={CheckCircle}
            trend="Active documents"
          />
          <StatCard
            title="Departments"
            value={departments.length}
            icon={Building2}
            trend="Active departments"
          />
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Document Management</h3>
            <Button variant="outline" size="sm" onClick={handleExportLogs} data-testid="button-export-logs">
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All ({allDocuments.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingDocs.length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedDocs.length})</TabsTrigger>
              <TabsTrigger value="issued">Issued ({issuedDocs.length})</TabsTrigger>
              <TabsTrigger value="declined">Declined ({declinedDocs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {isLoading ? (
                <div className="border rounded-lg p-12 text-center">
                  <p className="text-sm text-muted-foreground">Loading documents...</p>
                </div>
              ) : allDocuments.length > 0 ? (
                <DocumentTable
                  documents={transformDocuments(allDocuments)}
                  onView={handleView}
                  showActions={true}
                />
              ) : (
                <div className="border rounded-lg p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No documents in the system</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-6">
              {pendingDocs.length > 0 ? (
                <DocumentTable
                  documents={transformDocuments(pendingDocs)}
                  onView={handleView}
                  showActions={true}
                />
              ) : (
                <div className="border rounded-lg p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No pending documents</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-6">
              {approvedDocs.length > 0 ? (
                <DocumentTable
                  documents={transformDocuments(approvedDocs)}
                  onView={handleView}
                  showActions={true}
                />
              ) : (
                <div className="border rounded-lg p-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No approved documents</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="issued" className="mt-6">
              {issuedDocs.length > 0 ? (
                <DocumentTable
                  documents={transformDocuments(issuedDocs)}
                  onView={handleView}
                  showActions={true}
                />
              ) : (
                <div className="border rounded-lg p-12 text-center">
                  <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No issued documents</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="declined" className="mt-6">
              {declinedDocs.length > 0 ? (
                <DocumentTable
                  documents={transformDocuments(declinedDocs)}
                  onView={handleView}
                  showActions={true}
                />
              ) : (
                <div className="border rounded-lg p-12 text-center">
                  <XCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No declined documents</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Departments</h3>
            {departments.length > 0 ? (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                    data-testid={`dept-${dept.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">{dept.name}</p>
                        <p className="text-sm text-muted-foreground">{dept.code}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No departments configured</p>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">System Information</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
                <span className="text-sm font-medium">Document Workflow Status</span>
                <span className="text-sm text-green-600 dark:text-green-400">Active</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
                <span className="text-sm font-medium">Storage System</span>
                <span className="text-sm text-muted-foreground">JSON File-Based</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
                <span className="text-sm font-medium">PDF Generation</span>
                <span className="text-sm text-amber-600 dark:text-amber-400">In Development</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
                <span className="text-sm font-medium">Control Copy Tracking</span>
                <span className="text-sm text-green-600 dark:text-green-400">Ready</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <DocumentViewDialog
        document={selectedDoc}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        onDownload={() => {}}
      />
    </DashboardLayout>
  );
}
