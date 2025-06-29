/**
 * ProfileEditor component allows users to edit their profile information,
 * including display name and avatar image. It displays a dialog with input fields
 * for the user's name and avatar, provides image preview, validates file type and size,
 * uploads the new avatar to Firebase Storage, and updates the user's profile using Firebase Auth.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.open - Controls whether the dialog is open.
 * @param {(open: boolean) => void} props.onOpenChange - Callback to handle dialog open state changes.
 *
 * @returns {JSX.Element} The profile editor dialog component.
 *
 * @remarks
 * - Uses Firebase for authentication and storage.
 * - Shows toast notifications for success, errors, and validation feedback.
 * - Resets state when dialog is opened.
 * - Limits avatar uploads to images under 2MB.
 */
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

// --- Firebase Imports ---
import { useUserAuth } from "@/context/UserAuthContext";
import { storage } from "@/integrations/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ProfileEditor({ open, onOpenChange }: Props) {
  const { user, loading: userLoading } = useUserAuth();
  const [name, setName] = useState(user?.displayName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setName(user?.displayName || "");
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [open, user]);

  // Generate preview URL
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: "Please select an image.", variant: "destructive" });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max size is 2MB.", variant: "destructive" });
        return;
      }
    }
    setAvatarFile(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    let newPhotoURL = user.photoURL;

    try {
      if (avatarFile) {
        const storageRef = ref(storage, `avatars/${user.uid}/${avatarFile.name}`);
        const snapshot = await uploadBytes(storageRef, avatarFile);
        newPhotoURL = await getDownloadURL(snapshot.ref);
      }

      if (name !== user.displayName || newPhotoURL !== user.photoURL) {
        await updateProfile(user, { displayName: name, photoURL: newPhotoURL });
        toast({ title: "Profile updated!" });
      } else {
        toast({ title: "No changes made" });
      }

      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {/* Avatar Preview */}
          <div className="mx-auto">
            <img
              src={avatarPreview ?? user?.photoURL ?? "/fallback-avatar.png"}
              alt="Avatar preview"
              className="w-24 h-24 rounded-full object-cover border"
            />
          </div>

          <Input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={saving}
          />

          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name"
            disabled={saving || userLoading}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || userLoading}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
