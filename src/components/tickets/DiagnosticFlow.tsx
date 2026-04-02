import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Stethoscope, CheckCircle2, RotateCcw, AlertTriangle, IndianRupee,
  Loader2, Brain, Zap, ChevronRight, Download, FileText, Plus, X, Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getDiagnosticQuestions, type DiagnosticQuestion } from '@/lib/diagnostic-questions';

interface DiagnosticCause {
  cause: string;
  probability: number;
  severity: 'low' | 'medium' | 'high';
  solution: string;
  estimatedCost: string;
  requiredParts?: { name: string; estimatedPrice: string }[];
}

interface DiagnosisResult {
  causes: DiagnosticCause[];
  summary: string;
  urgency: string;
  recommendedAction: string;
}

interface QA {
  question: string;
  answer: string;
}

interface PartItem {
  item_name: string;
  cost_type: string;
  quantity: number;
  unit_price: number;
}

interface DiagnosticFlowProps {
  issueTypeName: string;
  issueSubType?: string;
  onComplete: (result: {
    answers: QA[];
    result: { cause: string; severity: string; estimatedCost: string; recommendation: string };
    fullDiagnosis?: DiagnosisResult;
    parts?: PartItem[];
    submitForApproval?: boolean;
  }) => void;
  onCancel: () => void;
}

type Stage = 'questioning' | 'ready_to_diagnose' | 'diagnosing' | 'result' | 'parts_approval';

export function DiagnosticFlow({ issueTypeName, issueSubType, onComplete, onCancel }: DiagnosticFlowProps) {
  // Load hardcoded questions instantly
  const allQuestions = getDiagnosticQuestions(issueTypeName, issueSubType);

  const [stage, setStage] = useState<Stage>('questioning');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answers, setAnswers] = useState<QA[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [selectedCause, setSelectedCause] = useState<DiagnosticCause | null>(null);
  const [diagnosisChoice, setDiagnosisChoice] = useState<'ai' | 'custom' | ''>('ai');
  const [customProblem, setCustomProblem] = useState('');
  const [customSolution, setCustomSolution] = useState('');
  const [parts, setParts] = useState<PartItem[]>([]);
  const [confirmedDiagnosis, setConfirmedDiagnosis] = useState<{ cause: string; severity: string; estimatedCost: string; recommendation: string } | null>(null);

  const currentQuestion = questionIndex < allQuestions.length ? allQuestions[questionIndex] : null;

  function handleAnswerSelect(val: string) {
    setSelectedAnswer(val);
    const option = currentQuestion?.options.find(o => o.value === val);
    if (!option || !currentQuestion) return;

    setTimeout(() => {
      const newAnswers = [...answers, { question: currentQuestion.question, answer: option.label }];
      setAnswers(newAnswers);
      setSelectedAnswer('');

      if (questionIndex + 1 >= allQuestions.length) {
        setStage('ready_to_diagnose');
      } else {
        setQuestionIndex(prev => prev + 1);
      }
    }, 400);
  }

  async function runDiagnosis() {
    setStage('diagnosing');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-diagnosis', {
        body: {
          issueType: issueTypeName,
          issueSubType: issueSubType || '',
          answers,
          action: 'run_diagnosis',
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDiagnosis(data);
      if (data?.causes?.length > 0) {
        setSelectedCause(data.causes[0]);
      }
      setStage('result');
    } catch (e: any) {
      toast({ title: 'Diagnosis failed', description: e.message, variant: 'destructive' });
      setStage('ready_to_diagnose');
    }
  }

  function handleConfirmAndContinue() {
    let diagResult: { cause: string; severity: string; estimatedCost: string; recommendation: string };

    if (diagnosisChoice === 'ai' && selectedCause) {
      diagResult = {
        cause: selectedCause.cause,
        severity: selectedCause.severity,
        estimatedCost: selectedCause.estimatedCost,
        recommendation: selectedCause.solution,
      };
      if (selectedCause.requiredParts?.length) {
        const aiParts: PartItem[] = selectedCause.requiredParts.map(p => {
          const priceStr = p.estimatedPrice || '';
          const numbers = priceStr.match(/[\d,]+/g);
          let unitPrice = 0;
          if (numbers && numbers.length >= 2) {
            const low = parseFloat(numbers[0].replace(/,/g, '')) || 0;
            const high = parseFloat(numbers[numbers.length - 1].replace(/,/g, '')) || 0;
            unitPrice = Math.round((low + high) / 2);
          } else if (numbers && numbers.length === 1) {
            unitPrice = parseFloat(numbers[0].replace(/,/g, '')) || 0;
          }
          return { item_name: p.name, cost_type: 'parts', quantity: 1, unit_price: unitPrice };
        });
        setParts(aiParts);
      }
    } else if (diagnosisChoice === 'custom') {
      diagResult = {
        cause: customProblem,
        severity: 'medium',
        estimatedCost: 'To be determined',
        recommendation: customSolution,
      };
    } else {
      return;
    }

    setConfirmedDiagnosis(diagResult);
    setStage('parts_approval');
  }

  function addPart() {
    setParts([...parts, { item_name: '', cost_type: 'parts', quantity: 1, unit_price: 0 }]);
  }

  function updatePart(index: number, field: keyof PartItem, value: any) {
    const updated = [...parts];
    (updated[index] as any)[field] = value;
    setParts(updated);
  }

  function removePart(index: number) {
    setParts(parts.filter((_, i) => i !== index));
  }

  function handleFinalSubmit(submitForApproval: boolean) {
    if (!confirmedDiagnosis) return;
    if (submitForApproval) {
      const validParts = parts.filter(p => p.item_name.trim());
      if (validParts.length === 0) {
        toast({ title: 'Add at least one part to submit for approval', variant: 'destructive' });
        return;
      }
      onComplete({ answers, result: confirmedDiagnosis, fullDiagnosis: diagnosis || undefined, parts: validParts, submitForApproval: true });
    } else {
      onComplete({ answers, result: confirmedDiagnosis, fullDiagnosis: diagnosis || undefined, parts: [], submitForApproval: false });
    }
  }

  function handleReset() {
    setStage('questioning');
    setQuestionIndex(0);
    setSelectedAnswer('');
    setAnswers([]);
    setDiagnosis(null);
    setSelectedCause(null);
    setDiagnosisChoice('ai');
    setCustomProblem('');
    setCustomSolution('');
    setParts([]);
    setConfirmedDiagnosis(null);
  }

  const severityColors = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };

  const urgencyColors: Record<string, string> = {
    low: 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20',
    medium: 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20',
    high: 'border-red-300 bg-red-50/50 dark:bg-red-950/20',
    critical: 'border-red-500 bg-red-100/50 dark:bg-red-950/30',
  };

  const validParts = parts.filter(p => p.item_name.trim());

  return (
    <div className="space-y-4">
      {/* Answered questions trail */}
      {answers.length > 0 && stage !== 'parts_approval' && (
        <div className="space-y-2">
          {answers.map((a, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-3 transition-all duration-300">
              <p className="text-xs text-muted-foreground">{a.question}</p>
              <p className="text-sm font-medium mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                {a.answer}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Loading state - only for AI diagnosis */}
      {stage === 'diagnosing' && (
        <Card className="border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <Brain className="h-8 w-8 text-primary/40 animate-pulse" />
              <Loader2 className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-spin" />
            </div>
            <p className="text-sm font-medium mt-3">Running AI diagnosis...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
          </CardContent>
        </Card>
      )}

      {/* Current question - auto-progresses */}
      {stage === 'questioning' && currentQuestion && (
        <Card className="border-primary/20">
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{currentQuestion.question}</p>
              <Badge variant="outline" className="text-[10px]">{questionIndex + 1}/{allQuestions.length}</Badge>
            </div>
            <RadioGroup
              value={selectedAnswer}
              onValueChange={handleAnswerSelect}
            >
              {currentQuestion.options.map(opt => (
                <div key={opt.value} className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors active:scale-[0.98]">
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label htmlFor={opt.value} className="cursor-pointer flex-1 text-sm">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Ready to diagnose */}
      {stage === 'ready_to_diagnose' && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-col items-center py-6">
            <Brain className="h-8 w-8 text-primary mb-3" />
            <p className="text-sm font-medium mb-1">Ready to analyze</p>
            <p className="text-xs text-muted-foreground mb-4 text-center">
              AI will analyze your responses and provide root causes, solutions, and cost estimates
            </p>
            <div className="flex gap-2">
              <Button onClick={runDiagnosis} className="gap-2">
                <Stethoscope className="h-4 w-4" /> Run Diagnosis
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restart
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis Results — AI vs Custom selection */}
      {stage === 'result' && diagnosis && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className={`border ${urgencyColors[diagnosis.urgency] || 'border-border'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                AI Diagnosis Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{diagnosis.summary}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Urgency:</span>
                <Badge variant="secondary" className={
                  diagnosis.urgency === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                  diagnosis.urgency === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                  diagnosis.urgency === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                }>
                  {diagnosis.urgency.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Diagnosis Choice: AI Suggested vs Custom */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Select Diagnosis Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={diagnosisChoice} onValueChange={(v) => {
                setDiagnosisChoice(v as 'ai' | 'custom');
                if (v === 'ai' && !selectedCause && diagnosis.causes.length > 0) {
                  setSelectedCause(diagnosis.causes[0]);
                }
              }}>
                {/* AI Suggested Option */}
                <div className={`rounded-lg border p-4 transition-all ${diagnosisChoice === 'ai' ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ai" id="diag-ai" />
                    <Label htmlFor="diag-ai" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">AI Suggested Diagnosis</span>
                      </div>
                    </Label>
                  </div>

                  {diagnosisChoice === 'ai' && (
                    <div className="mt-3 ml-6 space-y-3">
                      {diagnosis.causes.map((cause, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedCause?.cause === cause.cause ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                          }`}
                          onClick={() => setSelectedCause(cause)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold">{cause.cause}</span>
                                <Badge variant="secondary" className={severityColors[cause.severity]}>{cause.severity}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{cause.solution}</p>
                            </div>
                            <div className="text-right ml-3">
                              <div className="text-lg font-bold text-primary">{cause.probability}%</div>
                              <p className="text-[10px] text-muted-foreground">probability</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs mt-2">
                            <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" /> {cause.estimatedCost}</span>
                          </div>
                          {cause.requiredParts && cause.requiredParts.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-1">Suggested Parts:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {cause.requiredParts.map((part, pi) => (
                                  <Badge key={pi} variant="outline" className="text-[10px]">
                                    {part.name} — {part.estimatedPrice}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Custom Diagnosis Option */}
                <div className={`rounded-lg border p-4 transition-all ${diagnosisChoice === 'custom' ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="diag-custom" />
                    <Label htmlFor="diag-custom" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">Custom Diagnosis</span>
                      </div>
                    </Label>
                  </div>

                  {diagnosisChoice === 'custom' && (
                    <div className="mt-3 ml-6 space-y-3">
                      <div>
                        <Label className="text-xs">Problem *</Label>
                        <Textarea value={customProblem} onChange={e => setCustomProblem(e.target.value)} placeholder="Describe the problem..." rows={2} />
                      </div>
                      <div>
                        <Label className="text-xs">Recommended Solution *</Label>
                        <Textarea value={customSolution} onChange={e => setCustomSolution(e.target.value)} placeholder="Describe the recommended solution..." rows={2} />
                      </div>
                    </div>
                  )}
                </div>
              </RadioGroup>

              {/* Confirm button */}
              <Button
                className="w-full gap-2"
                onClick={handleConfirmAndContinue}
                disabled={
                  (diagnosisChoice === 'ai' && !selectedCause) ||
                  (diagnosisChoice === 'custom' && (!customProblem.trim() || !customSolution.trim()))
                }
              >
                <CheckCircle2 className="h-4 w-4" /> Confirm Problem & Continue
              </Button>

              <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Redo Diagnosis
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Parts & Approval Stage */}
      {stage === 'parts_approval' && confirmedDiagnosis && (
        <div className="space-y-4">
          <Card className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Confirmed Diagnosis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Problem:</span><p className="font-medium">{confirmedDiagnosis.cause}</p></div>
                <div><span className="text-muted-foreground text-xs">Estimated Cost:</span><p className="font-medium">{confirmedDiagnosis.estimatedCost}</p></div>
              </div>
              <div className="text-sm"><span className="text-muted-foreground text-xs">Recommended Solution:</span><p className="font-medium">{confirmedDiagnosis.recommendation}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" /> Parts & Cost Estimation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {parts.length > 0 ? 'Review and modify parts below. Add more if needed.' : 'No parts added yet. Click "Add Part" to add parts for cost estimation.'}
              </p>

              {parts.map((part, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Part Name *</Label>
                      <Input value={part.item_name} onChange={e => updatePart(i, 'item_name', e.target.value)} placeholder="e.g., Capacitor" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Type</Label>
                      <Select value={part.cost_type} onValueChange={v => updatePart(i, 'cost_type', v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parts">Parts</SelectItem>
                          <SelectItem value="labor">Labor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Quantity</Label>
                      <Input type="number" min={1} value={part.quantity} onChange={e => updatePart(i, 'quantity', parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Unit Price (₹)</Label>
                      <Input type="number" min={0} value={part.unit_price} onChange={e => updatePart(i, 'unit_price', parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 pt-4">
                    <span className="text-xs font-bold">₹{(part.quantity * part.unit_price).toLocaleString()}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePart(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={addPart} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Part
              </Button>

              {validParts.length > 0 && (
                <div className="text-sm font-bold text-right border-t pt-2">
                  Total: ₹{validParts.reduce((s, p) => s + p.quantity * p.unit_price, 0).toLocaleString()}
                </div>
              )}

              <Separator />

              <div className="flex gap-2">
                {validParts.length === 0 ? (
                  <Button className="flex-1 gap-2" onClick={() => handleFinalSubmit(false)}>
                    <CheckCircle2 className="h-4 w-4" /> Complete Diagnosis
                  </Button>
                ) : (
                  <Button className="flex-1 gap-2" onClick={() => handleFinalSubmit(true)}>
                    <Stethoscope className="h-4 w-4" /> Submit for Approval
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setStage('result')}>
                  ← Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel */}
      {stage !== 'result' && stage !== 'parts_approval' && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
