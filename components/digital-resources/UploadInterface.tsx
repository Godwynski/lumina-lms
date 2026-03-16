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
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">Upload Digital Resource</h3>
          <p className="text-sm text-zinc-500">Add new e-books, journals, or theses</p>
        </div>
        <FileText className="text-indigo-500" size={24} />
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={16} />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 text-emerald-700 text-sm">
            <CheckCircle2 className="shrink-0 mt-0.5" size={16} />
            <p>Resource uploaded successfully!</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Advanced Calculus"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Resource Type</Label>
            <Select value={type} onValueChange={setType} disabled={uploading}>
              <SelectTrigger>
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
              <SelectTrigger>
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
              <SelectTrigger>
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
              className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                file ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 hover:border-indigo-300 hover:bg-zinc-50"
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
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="text-sm font-medium text-zinc-900 truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="p-1 hover:bg-zinc-200 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="text-zinc-400 mb-2" size={24} />
                  <p className="text-sm font-medium text-zinc-600">Click or drag file to upload</p>
                  <p className="text-xs text-zinc-400">PDF or EPUB up to 500MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        {uploading && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between text-xs font-medium text-zinc-600">
              <span>Uploading... {Math.round(uploadProgress)}%</span>
              <span>{estimatedTime}</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        <div className="pt-4 border-t border-zinc-100 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setFile(null);
              setTitle("");
              setAuthor("");
              setError(null);
              setSuccess(false);
              if (onCancel) onCancel();
            }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={uploading || !file || !title || !author}
            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
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
