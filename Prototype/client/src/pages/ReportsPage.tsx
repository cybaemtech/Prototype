import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrintLog {
  id: string;
  documentId: string;
  userId: string;
  controlCopyId: string;
  printedAt: string;
  documentName: string;
  documentNumber: string;
  userName: string;
  userEmail: string;
  controlCopyNumber: number;
}

export default function ReportsPage() {
  const [searchDocId, setSearchDocId] = useState("");
  const [searchUserId, setSearchUserId] = useState("");
  const [activeTab, setActiveTab] = useState("printLogs");
  const { toast } = useToast();

  const { data: printLogsByDoc, isLoading: loadingByDoc, refetch: refetchByDoc } = useQuery<PrintLog[]>({
    queryKey: ["/api/reports/print-logs", searchDocId],
    enabled: !!searchDocId && activeTab === "printLogs",
  });

  const { data: printLogsByUser, isLoading: loadingByUser, refetch: refetchByUser } = useQuery<PrintLog[]>({
    queryKey: [`/api/reports/print-logs?userId=${searchUserId}`],
    enabled: !!searchUserId && activeTab === "printLogs",
  });

  const { data: issuedDocs, isLoading: loadingIssued } = useQuery<any[]>({
    queryKey: ["/api/documents", { status: "issued" }],
    queryFn: async () => {
      const response = await fetch('/api/documents?status=issued');
      if (!response.ok) throw new Error('Failed to fetch issued documents');
      return response.json();
    },
    enabled: activeTab === "issuedDocs",
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No data available to export",
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Data exported to ${filename}.csv`,
    });
  };

  const renderPrintLogs = (logs: PrintLog[] | undefined, loading: boolean) => {
    if (loading) {
      return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    }

    if (!logs || logs.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No print logs found</div>;
    }

    return (
      <>
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => exportToCSV(logs, 'print_logs')}
            variant="outline"
            data-testid="button-export-print-logs"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to CSV
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Number</TableHead>
              <TableHead>Document Name</TableHead>
              <TableHead>User Name</TableHead>
              <TableHead>User Email</TableHead>
              <TableHead>Control Copy No.</TableHead>
              <TableHead>Printed At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} data-testid={`row-print-log-${log.id}`}>
                <TableCell className="font-mono">{log.documentNumber}</TableCell>
                <TableCell>{log.documentName}</TableCell>
                <TableCell>{log.userName}</TableCell>
                <TableCell>{log.userEmail}</TableCell>
                <TableCell className="font-mono">{log.controlCopyNumber}</TableCell>
                <TableCell>{new Date(log.printedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-reports-title">
          <FileSpreadsheet className="w-8 h-8" />
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground mt-2">
          View and export print logs and issued document reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="printLogs" data-testid="tab-print-logs">
            Print Logs
          </TabsTrigger>
          <TabsTrigger value="issuedDocs" data-testid="tab-issued-docs">
            Issued Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="printLogs" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Search Print Logs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="docId">By Document ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="docId"
                    placeholder="Enter document ID"
                    value={searchDocId}
                    onChange={(e) => setSearchDocId(e.target.value)}
                    data-testid="input-search-doc-id"
                  />
                  <Button onClick={() => refetchByDoc()} disabled={!searchDocId} data-testid="button-search-doc">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userId">By User ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="userId"
                    placeholder="Enter user ID"
                    value={searchUserId}
                    onChange={(e) => setSearchUserId(e.target.value)}
                    data-testid="input-search-user-id"
                  />
                  <Button onClick={() => refetchByUser()} disabled={!searchUserId} data-testid="button-search-user">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            {searchDocId && renderPrintLogs(printLogsByDoc, loadingByDoc)}
            {searchUserId && renderPrintLogs(printLogsByUser, loadingByUser)}
            {!searchDocId && !searchUserId && (
              <div className="text-center py-8 text-muted-foreground">
                Enter a document ID or user ID to view print logs
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="issuedDocs" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Issued Documents</h2>
              {issuedDocs && issuedDocs.length > 0 && (
                <Button
                  onClick={() => exportToCSV(issuedDocs, 'issued_documents')}
                  variant="outline"
                  data-testid="button-export-issued-docs"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
              )}
            </div>

            {loadingIssued ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : !issuedDocs || issuedDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No issued documents found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Number</TableHead>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Revision</TableHead>
                    <TableHead>Issued By</TableHead>
                    <TableHead>Issued At</TableHead>
                    <TableHead>Departments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuedDocs.map((doc: any) => (
                    <TableRow key={doc.id} data-testid={`row-issued-doc-${doc.id}`}>
                      <TableCell className="font-mono">{doc.docNumber}</TableCell>
                      <TableCell>{doc.docName}</TableCell>
                      <TableCell>Rev {doc.revisionNo}</TableCell>
                      <TableCell>{doc.issuerName || 'N/A'}</TableCell>
                      <TableCell>{doc.issuedAt ? new Date(doc.issuedAt).toLocaleString() : 'N/A'}</TableCell>
                      <TableCell>
                        {doc.departments?.map((d: any) => d.name).join(', ') || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
