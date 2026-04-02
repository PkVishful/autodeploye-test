import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Shield, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import vishfulLogo from "@/assets/vishful-logo.png";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const sendOtp = async () => {
    if (!phone || phone.length < 10) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const smsEnabled = import.meta.env.VITE_SMS_ENABLED !== "false";
      const res = await supabase.functions.invoke("auth-otp", {
        body: { phone, action: "send_otp", sms_enabled: smsEnabled },
      });

      // Handle 403/404 from edge function
      if (res.data?.error) {
        toast({ title: "Login Failed", description: res.data.error, variant: "destructive" });
        setLoading(false);
        return;
      }
      if (res.error) throw new Error(res.error.message);
      setStep("otp");
      toast({ title: "OTP sent!", description: "Please check your SMS for the OTP" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("auth-otp", {
        body: { phone, otp, action: "verify_otp" },
      });
      if (res.data?.error) {
        throw new Error(res.data.error);
      }
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (data.user_type === "tenant") {
          navigate("/tenant-home");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (e: any) {
      const msg = e.message || "Verification failed";
      toast({ title: "Login Failed", description: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className=" w-[350px] sm:w-[400px] shadow-2xl border-0 glass-strong">
          <CardHeader className="text-center pb-0">
            <img src={vishfulLogo} alt="Vishful Spaces LLP" className="mx-auto h-32 w-auto mb-3" />
            <CardTitle className="text-2xl font-bold tracking-tight">Vishful OS</CardTitle>
            <CardDescription className="text-muted-foreground">Property Management Platform</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <AnimatePresence mode="wait">
              {step === "phone" ? (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="enter mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 h-11"
                        onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                      />
                    </div>
                  </div>
                  <Button className="w-full h-11 gap-2" onClick={sendOtp} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Send OTP
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground text-center">
                    OTP sent to <strong>{phone}</strong>
                  </p>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Enter OTP</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="pl-10 h-11 text-center tracking-[0.5em] text-lg font-mono"
                        maxLength={6}
                        onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                      />
                    </div>
                  </div>
                  <Button className="w-full h-11 gap-2" onClick={verifyOtp} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Verify & Login
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => setStep("phone")}>
                    Change Number
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
