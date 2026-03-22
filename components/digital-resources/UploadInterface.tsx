"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

interface UploadInterfaceProps {
  categories: { id: string; name: string }[];
  onUploadSuccess?: () => void;
  onCancel?: () => void;
}

export function UploadInterface({ categories, onUploadSuccess, onCancel }: UploadInterfaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publishedYear, setPublishedYear] = useState("");
  const [type, setType] = useState("ebook");
  const [categoryId, setCategoryId] = useState("");
  const [accessLevel, setAccessLevel] = useState("STUDENT");
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf" && selectedFile.type !== "application/epub+zip") {
        setError("Invalid file type. Only PDF and EPUB are allowed.");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !author) {
      setError("Please fill in all required fields and select a file.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("author", author);
    formData.append("publishedYear", publishedYear);
    formData.append("type", type);
    formData.append("categoryId", categoryId);
    formData.append("accessLevel", accessLevel);

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        setUploadProgress(progress);

        // Estimate time remaining
        const elapsedTime = (Date.now() - startTime) / 1000;
        const speed = event.loaded / elapsedTime;
        const remainingBytes = event.total - event.loaded;
        const remainingTime = remainingBytes / speed;

        if (remainingTime > 60) {
          setEstimatedTime(`${Math.round(remainingTime / 60)}m remaining`);
        } else {
          setEstimatedTime(`${Math.round(remainingTime)}s remaining`);
        }
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setSuccess(true);
        setFile(null);
        setTitle("");
        setAuthor("");
        setPublishedYear("");
        router.refresh();
        if (onUploadSuccess) onUploadSuccess();
      } else {
        const response = JSON.parse(xhr.responseText);
        setError(response.error || "Upload failed");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("Network error occurred during upload.");
    };

    xhr.open("POST", "/api/resources/upload");
    xhr.send(formData);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted p-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Upload Resource</h3>
          <p className="text-xs text-muted-foreground">PDF or EPUB</p>
        </div>
        <FileText className="text-muted-foreground" size={18} />
      </div>

      <div className="space-y-3 p-3">
        {error && (
          <div className="status-danger flex items-start gap-2 rounded-lg p-2 text-xs">
            <AlertCircle className="shrink-0 mt-0.5" size={16} />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="status-success flex items-start gap-2 rounded-lg p-2 text-xs">
            <CheckCircle2 className="shrink-0 mt-0.5" size={16} />
            <p>Resource uploaded successfully!</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Advanced Calculus"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                className="h-8 rounded-md text-xs"
              />
            </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author *</Label>
              <Input
                id="author"
                placeholder="e.g. John Doe"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                disabled={uploading}
                className="h-8 rounded-md text-xs"
              />
            </div>

          <div className="space-y-2">
            <Label htmlFor="publishedYear">Year Published</Label>
              <Input
                id="publishedYear"
                placeholder="e.g. 2024"
                value={publishedYear}
                onChange={(e) => setPublishedYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                disabled={uploading}
                inputMode="numeric"
                className="h-8 rounded-md text-xs"
              />
            </div>

          <div className="space-y-2">
            <Label htmlFor="type">Resource Type</Label>
              <Select value={type} onValueChange={setType} disabled={uploading}>
                <SelectTrigger className="h-8 rounded-md text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="ebook">E-Book</SelectItem>
                <SelectItem value="journal">Journal</SelectItem>
                <SelectItem value="thesis">Thesis</SelectItem>
                <SelectItem value="report">Report</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={uploading}>
                <SelectTrigger className="h-8 rounded-md text-xs">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessLevel">Access Level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel} disabled={uploading}>
                <SelectTrigger className="h-8 rounded-md text-xs">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Student (Public)</SelectItem>
                <SelectItem value="STAFF">Staff Only</SelectItem>
                <SelectItem value="LIBRARIAN">Librarian Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>File (PDF/EPUB) *</Label>
            <div
              className={`cursor-pointer rounded-lg border-2 border-dashed p-2.5 transition-colors ${
                file ? "border-border bg-muted" : "border-border hover:border-border hover:bg-muted"
              }`}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.epub"
                disabled={uploading}
              />
              {file ? (
                <div className="flex items-center gap-3 w-full">
                  <div className="status-success rounded-md p-1.5">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                    <Button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md p-0 transition-colors hover:bg-muted"
                    >
                      <X size={16} />
                    </Button>
                </div>
              ) : (
                <>
                  <Upload className="mb-1 text-muted-foreground" size={16} />
                  <p className="text-xs font-medium text-muted-foreground">Click or drag file</p>
                  <p className="text-xs text-muted-foreground">PDF or EPUB up to 500MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        {uploading && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>Uploading... {Math.round(uploadProgress)}%</span>
              <span>{estimatedTime}</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setFile(null);
              setTitle("");
              setAuthor("");
              setPublishedYear("");
              setError(null);
              setSuccess(false);
              if (onCancel) onCancel();
            }}
            disabled={uploading}
            className="h-8 rounded-md text-xs"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={uploading || !file || !title || !author}
            className="h-8 min-w-[110px] rounded-md bg-primary text-xs text-primary-foreground hover:bg-primary/90"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading
              </>
            ) : (
              "Upload Resource"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
