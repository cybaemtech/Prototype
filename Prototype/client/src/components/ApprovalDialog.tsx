import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Department {
  id: string;
  name: string;
}

interface ApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  onApprove?: (data: { remarks: string; departments: string[]; approverName: string }) => void;
  onDecline?: (remarks: string) => void;
  title?: string;
  type?: "approve" | "decline";
  departments?: Department[];
  approverName?: string;
}

export default function ApprovalDialog({
  open,
  onClose,
  onApprove,
  onDecline,
  title = "Document Approval",
  type = "approve",
  departments = [],
  approverName: initialApproverName = "",
}: ApprovalDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [approverName, setApproverName] = useState(initialApproverName);

  const handleDepartmentToggle = (deptId: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = () => {
    if (type === "approve") {
      onApprove?.({ remarks, departments: selectedDepartments, approverName });
    } else {
      onDecline?.(remarks);
    }
    setRemarks("");
    setSelectedDepartments([]);
    setApproverName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-approval">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {type === "approve" && (
            <div className="space-y-2">
              <Label htmlFor="approverName">Approved By *</Label>
              <Input
                id="approverName"
                placeholder="Enter your name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                data-testid="input-approver-name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks *</Label>
            <Textarea
              id="remarks"
              placeholder={
                type === "approve"
                  ? "Add approval remarks..."
                  : "Add reason for declining..."
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              data-testid="input-remarks"
            />
          </div>

          {type === "approve" && departments.length > 0 && (
            <div className="space-y-3">
              <Label>Share with Departments (Optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={dept.id}
                      checked={selectedDepartments.includes(dept.id)}
                      onCheckedChange={() => handleDepartmentToggle(dept.id)}
                      data-testid={`checkbox-dept-${dept.id}`}
                    />
                    <Label htmlFor={dept.id} className="text-sm font-normal cursor-pointer">
                      {dept.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!remarks.trim() || (type === "approve" && !approverName.trim())}
            variant={type === "approve" ? "default" : "destructive"}
            data-testid={`button-${type}`}
          >
            {type === "approve" ? "Approve" : "Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
