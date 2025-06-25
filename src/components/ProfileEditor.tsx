import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

const ProfileEditor: React.FC<Props> = ({ open, onOpenChange }) => {
  const { user, loading } = useUserAuth(); // Use our Firebase auth hook
  const [name, setName] = useState(user?.displayName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // When the dialog opens, reset the state to the current user's profile
    if (open) {
      setName(user?.displayName || "");
      setAvatarFile(null);
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return; // Should not happen if the dialog is open, but a good guard clause

    setSaving(true);
    let newPhotoURL = user.photoURL; // Start with the existing photo URL

    try {
      // 1. If a new avatar file was selected, upload it to Firebase Storage
      if (avatarFile) {
        // Create a storage reference (e.g., 'avatars/user-uid/avatar.png')
        const storageRef = ref(storage, `avatars/${user.uid}/${avatarFile.name}`);

        // Upload the file
        const snapshot = await uploadBytes(storageRef, avatarFile);

        // Get the public URL of the uploaded file
        newPhotoURL = await getDownloadURL(snapshot.ref);
      }

      // 2. Update the user's profile in Firebase Authentication
      await updateProfile(user, {
        displayName: name,
        photoURL: newPhotoURL,
      });

      toast({ title: "Profile updated successfully!" });
      onOpenChange(false); // Close the dialog on success

    } catch (error: any) {
      toast({ title: "Profile update failed", description: error.message, variant: "destructive" });
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
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt="avatar"
              className="mx-auto w-24 h-24 rounded-full object-cover border mb-2"
            />
          )}
          <Input
            type="file"
            accept="image/*"
            onChange={e => setAvatarFile(e.target.files?.[0] || null)}
            disabled={saving}
          />
          <Input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full Name"
            disabled={saving}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditor;