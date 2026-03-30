"use client";

import { useState, useRef } from "react";
import { CheckCircle2, AlertCircle, X, Loader2, CloudUpload } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  const [type, setType] = useState("capstone");
  const [categoryId, setCategoryId] = useState("");
  const [accessLevel, setAccessLevel] = useState("STUDENT");
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        const elapsedTime = (Date.now() - startTime) / 1000;
        const speed = event.loaded / elapsedTime;
        const remainingBytes = event.total - event.loaded;
        const remainingTime = remainingBytes / speed;
        setEstimatedTime(remainingTime > 60 ? `${Math.round(remainingTime / 60)}m` : `${Math.round(remainingTime)}s`);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
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
    <div className="flex flex-col gap-8">
      {/* File Drop Section */}
      <div 
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/30 p-12 transition-all hover:border-primary/40 hover:bg-muted/50",
          file && "border-solid border-primary/20 bg-primary/[0.02]"
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.epub" disabled={uploading} />
        
        {file ? (
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 size={32} strokeWidth={1.5} />
            </div>
            <h4 className="mb-1 text-sm font-bold tracking-tight text-foreground">{file.name}</h4>
            <p className="text-xs font-semibold text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for ingest</p>
            {!uploading && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-4 h-7 gap-1.5 font-bold text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                >
                    <X size={14} /> Clear Selection
                </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center transition-transform group-hover:scale-105">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/60 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <CloudUpload size={32} strokeWidth={1.5} />
            </div>
            <h4 className="mb-1 text-sm font-bold tracking-tight text-foreground">Click to select or drag and drop</h4>
            <p className="text-xs font-semibold text-muted-foreground">Theses & Capstones (PDF only, up to 500MB)</p>
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
            <Label htmlFor="title" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Resource Title</Label>
            <Input id="title" placeholder="Advanced AI Studies" value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} className="h-10 rounded-lg font-medium" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="author" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Primary Author</Label>
            <Input id="author" placeholder="Johnathan Miller" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={uploading} className="h-10 rounded-lg font-medium" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="publishedYear" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Publication Year</Label>
            <Input id="publishedYear" value={publishedYear} onChange={(e) => setPublishedYear(e.target.value.replace(/\D/g, "").slice(0, 4))} disabled={uploading} className="h-10 rounded-lg font-medium" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="type" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Thesis Type</Label>
            <Select value={type} onValueChange={setType} disabled={uploading}>
                <SelectTrigger className="h-10 rounded-lg font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="capstone">Capstone Project</SelectItem>
                  <SelectItem value="thesis">Graduate Thesis</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="category" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Academic Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={uploading}>
                <SelectTrigger className="h-10 rounded-lg font-medium">
                  <SelectValue placeholder="Select faculty..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="accessLevel" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Permissions Level</Label>
            <Select value={accessLevel} onValueChange={setAccessLevel} disabled={uploading}>
                <SelectTrigger className="h-10 rounded-lg font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student (Vault Access)</SelectItem>
                  <SelectItem value="STAFF">Faculty Restricted</SelectItem>
                  <SelectItem value="LIBRARIAN">Internal Admin Only</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      {uploading && (
        <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Ingesting File...</p>
            <span className="text-[10px] font-bold text-muted-foreground">{estimatedTime} remaining</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Persistence Controls */}
      <div className="flex items-center justify-end gap-3 pt-6">
        <Button variant="ghost" onClick={onCancel} disabled={uploading} className="h-10 rounded-xl px-6 font-bold tracking-tight opacity-60 hover:opacity-100">
           Abort
        </Button>
        <Button onClick={handleUpload} disabled={uploading || !file || !title || !author} className="h-10 min-w-[140px] rounded-xl bg-primary font-bold tracking-tight shadow-lg shadow-primary/20">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : "Commit to Vault"}
        </Button>
      </div>
    </div>
  );
}
