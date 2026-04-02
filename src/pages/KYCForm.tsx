import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Upload, User, Briefcase, Phone, Building2, CreditCard, FileText } from "lucide-react";
import { motion } from "framer-motion";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Simple client-side image compression
async function compressImage(file: File, maxWidth = 800, quality = 0.6): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let w = img.width,
          h = img.height;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", quality);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function KYCForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    relation_type: "",
    relation_name: "",
    date_of_birth: "",
    food_preference: "",
    gender: "",
    address: "",
    city: "",
    pincode: "",
    state: "",
    age: "",
    profession: "",
    company_name: "",
    date_of_joining: "",
    designation: "",
    company_address: "",
    company_city: "",
    company_pincode: "",
    company_state: "",
    emergency_contact_name: "",
    emergency_contact_relation: "",
    emergency_contact_phone: "",
    bank_name: "",
    bank_branch: "",
    bank_account_number: "",
    bank_account_holder: "",
    bank_ifsc: "",
    aadhar_number: "",
    pan_number: "",
    gst_number: "",
    gst_name: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const aadharRef = useRef<HTMLInputElement>(null);
  const idCardRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const compressed = await compressImage(file);
    const ext = "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, compressed, { contentType: "image/jpeg" });
    if (error) throw error;
    return supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    // Required field validation
    const requiredFields: { key: string; label: string }[] = [
      { key: "first_name", label: "First Name" },
      { key: "last_name", label: "Last Name" },
      { key: "phone", label: "Mobile" },
      { key: "email", label: "Email" },
      { key: "gender", label: "Gender" },
      { key: "relation_type", label: "S/W/D of" },
      { key: "relation_name", label: "Relation Name" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "food_preference", label: "Food Preference" },
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "pincode", label: "Pincode" },
      { key: "state", label: "State" },
      { key: "age", label: "Age" },
      { key: "profession", label: "Profession" },
      { key: "emergency_contact_name", label: "Emergency Contact Name" },
      { key: "emergency_contact_relation", label: "Emergency Contact Relation" },
      { key: "emergency_contact_phone", label: "Emergency Contact Phone" },
      { key: "bank_name", label: "Bank Name" },
      { key: "bank_branch", label: "Bank Branch" },
      { key: "bank_account_number", label: "Account Number" },
      { key: "bank_account_holder", label: "Account Holder Name" },
      { key: "bank_ifsc", label: "IFSC Code" },
      { key: "aadhar_number", label: "Aadhaar Number" },
      { key: "pan_number", label: "PAN Number" },
    ];
    const missing = requiredFields.filter((f) => !(form as any)[f.key]?.toString().trim());
    if (missing.length > 0) {
      toast({
        title: "Required fields missing",
        description: `Please fill: ${missing.map((f) => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    if (!/^\d{10}$/.test(form.phone)) {
      toast({
        title: "Invalid Mobile Number",
        description: "Mobile must be exactly 10 digits",
        variant: "destructive",
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (!aadharFile) {
      toast({
        title: "Aadhaar Image Required",
        description: "Please upload your Aadhaar image",
        variant: "destructive",
      });
      return;
    }
    if (!photoFile) {
      toast({ title: "Photo Required", description: "Please upload your photo", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let photo_url = null,
        aadhar_image_url = null,
        id_card_url = null;
      try {
        if (photoFile) photo_url = await uploadFile(photoFile, "kyc-photos");
        if (aadharFile) aadhar_image_url = await uploadFile(aadharFile, "kyc-aadhar");
        if (idCardFile) id_card_url = await uploadFile(idCardFile, "kyc-idcards");
      } catch (uploadErr: any) {
        console.error("KYC file upload error:", uploadErr);
        throw new Error(`File upload failed: ${uploadErr.message}`);
      }
      console.log("KYC uploads successful, inserting tenant record...");

      const { error } = await supabase.from("tenants").insert({
        organization_id: DEFAULT_ORG_ID,
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        phone: form.phone,
        email: form.email,
        gender: form.gender || null,
        relation_type: form.relation_type || null,
        relation_name: form.relation_name || null,
        date_of_birth: form.date_of_birth || null,
        food_preference: form.food_preference || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        age: form.age ? parseInt(form.age) : null,
        profession: form.profession || null,
        company_name: form.company_name || null,
        date_of_joining: form.date_of_joining || null,
        designation: form.designation || null,
        company_address: form.company_address || null,
        company_city: form.company_city || null,
        company_state: form.company_state || null,
        company_pincode: form.company_pincode || null,
        id_card_url: id_card_url || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_relation: form.emergency_contact_relation || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        bank_name: form.bank_name || null,
        bank_branch: form.bank_branch || null,
        bank_account_number: form.bank_account_number || null,
        bank_account_holder: form.bank_account_holder || null,
        bank_ifsc: form.bank_ifsc || null,
        aadhar_number: form.aadhar_number || null,
        pan_number: form.pan_number || null,
        gst_number: form.gst_number || null,
        gst_name: form.gst_name || null,
        aadhar_image_url: aadhar_image_url || null,
        photo_url: photo_url || null,
        staying_status: "new",
        kyc_completed: true,
      } as any);
      if (error) throw error;
      toast({ title: "Form submitted successfully", description: "Your KYC details have been recorded." });
      // Reset form after a short delay
      setTimeout(() => {
        setForm({
          first_name: "",
          last_name: "",
          phone: "",
          email: "",
          relation_type: "",
          relation_name: "",
          date_of_birth: "",
          food_preference: "",
          gender: "",
          address: "",
          city: "",
          pincode: "",
          state: "",
          age: "",
          profession: "",
          company_name: "",
          date_of_joining: "",
          designation: "",
          company_address: "",
          company_city: "",
          company_pincode: "",
          company_state: "",
          emergency_contact_name: "",
          emergency_contact_relation: "",
          emergency_contact_phone: "",
          bank_name: "",
          bank_branch: "",
          bank_account_number: "",
          bank_account_holder: "",
          bank_ifsc: "",
          aadhar_number: "",
          pan_number: "",
          gst_number: "",
          gst_name: "",
        });
        setPhotoFile(null);
        setAadharFile(null);
        setIdCardFile(null);
        setSubmitted(true);
      }, 1500);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="w-full max-w-md text-center">
            <CardContent className="p-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">KYC Submitted!</h2>
              <p className="text-muted-foreground">
                Your details have been submitted successfully. The management team will review and update your status.
                You will be able to log in once onboarding is completed.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="flex items-center gap-2 mb-4 mt-6 first:mt-0">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
  );

  const FileUpload = ({
    label,
    file,
    onFile,
    inputRef,
    required,
  }: {
    label: string;
    file: File | null;
    onFile: (f: File) => void;
    inputRef: React.RefObject<HTMLInputElement>;
    required?: boolean;
  }) => (
    <div>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors mt-1"
      >
        {file ? (
          <p className="text-sm text-primary">{file.name}</p>
        ) : (
          <>
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Click to upload (JPEG/PNG, max 1MB)</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 1 * 1024 * 1024) {
            toast({ title: "File too large", description: "Image must be less than 1 MB", variant: "destructive" });
            e.target.value = "";
            return;
          }
          if (!["image/jpeg", "image/jpg", "image/png"].includes(f.type)) {
            toast({
              title: "Invalid file type",
              description: "Only JPEG, JPG, and PNG files are allowed",
              variant: "destructive",
            });
            e.target.value = "";
            return;
          }
          onFile(f);
        }}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
            <span className="text-primary-foreground font-bold text-lg">V</span>
          </div>
          <h1 className="text-2xl font-bold">Tenant KYC Form</h1>
          <p className="text-sm text-muted-foreground mt-1">Please fill in your details for onboarding</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-1">
            {/* Personal */}
            <SectionHeader icon={User} title="Personal Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div>
                <Label>Mobile *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="10 digit number"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>S/W/D of</Label>
                <Select value={form.relation_type} onValueChange={(v) => setForm({ ...form, relation_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S/O">S/O</SelectItem>
                    <SelectItem value="W/O">W/O</SelectItem>
                    <SelectItem value="D/O">D/O</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={form.relation_name}
                  onChange={(e) => setForm({ ...form, relation_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Food Preference</Label>
                <Select value={form.food_preference} onValueChange={(v) => setForm({ ...form, food_preference: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Veg">Veg</SelectItem>
                    <SelectItem value="Non-Veg">Non-Veg</SelectItem>
                    <SelectItem value="Egg">Egg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Age</Label>
                <Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div>
                <Label>Profession</Label>
                <Input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
              </div>
            </div>
            <div className="mt-4">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>
              <div>
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>

            <Separator className="my-6" />
            <SectionHeader icon={Briefcase} title="Professional Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Company / College</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div>
                <Label>Date of Joining</Label>
                <Input
                  type="date"
                  value={form.date_of_joining}
                  onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
                />
              </div>
              <div>
                <Label>Designation / Course</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </div>
            </div>
            <div className="mt-4">
              <Label>Company Address</Label>
              <Input
                value={form.company_address}
                onChange={(e) => setForm({ ...form, company_address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div>
                <Label>City</Label>
                <Input value={form.company_city} onChange={(e) => setForm({ ...form, company_city: e.target.value })} />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={form.company_pincode}
                  onChange={(e) => setForm({ ...form, company_pincode: e.target.value })}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={form.company_state}
                  onChange={(e) => setForm({ ...form, company_state: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <FileUpload
                label="ID Card (Optional)"
                file={idCardFile}
                onFile={setIdCardFile}
                inputRef={idCardRef as any}
              />
            </div>

            <Separator className="my-6" />
            <SectionHeader icon={Phone} title="Emergency Contact" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Contact Name</Label>
                <Input
                  value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Relationship</Label>
                <Input
                  value={form.emergency_contact_relation}
                  onChange={(e) => setForm({ ...form, emergency_contact_relation: e.target.value })}
                />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  value={form.emergency_contact_phone}
                  onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                />
              </div>
            </div>

            <Separator className="my-6" />
            <SectionHeader icon={Building2} title="Bank Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Bank Name</Label>
                <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              </div>
              <div>
                <Label>Branch</Label>
                <Input value={form.bank_branch} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input
                  value={form.bank_account_number}
                  onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Account Holder Name</Label>
                <Input
                  value={form.bank_account_holder}
                  onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })}
                />
              </div>
              <div>
                <Label>IFSC Code</Label>
                <Input value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} />
              </div>
            </div>

            <Separator className="my-6" />
            <SectionHeader icon={FileText} title="ID & Documents" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Aadhaar Number</Label>
                <Input
                  value={form.aadhar_number}
                  onChange={(e) => setForm({ ...form, aadhar_number: e.target.value })}
                />
              </div>
              <div>
                <Label>PAN Number</Label>
                <Input value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value })} />
              </div>
              <div>
                <Label>GST Number (Optional)</Label>
                <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
              </div>
              <div>
                <Label>GST Name (Optional)</Label>
                <Input value={form.gst_name} onChange={(e) => setForm({ ...form, gst_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <FileUpload
                label="Aadhaar Image"
                file={aadharFile}
                onFile={setAadharFile}
                inputRef={aadharRef as any}
                required
              />
              <FileUpload
                label="Your Photo"
                file={photoFile}
                onFile={setPhotoFile}
                inputRef={photoRef as any}
                required
              />
            </div>

            <Separator className="my-6" />
            <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
              Submit KYC
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
