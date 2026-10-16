import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Award,
  Zap,
  FileText,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  ExternalLink,
  HelpCircle,
  Clock,
  Shield,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { AssignmentFile } from './AssignmentAttachmentUploader';

interface TeacherGradingModalProps {
  assignment: {
    id: string;
    title: string;
    subject: string;
    description?: string;
    dueDate: string;
    hasQuestions?: boolean;
    questionsCount?: number;
    questionDifficulty?: 'easy' | 'medium' | 'hard';
    xpReward: number;
    doubleXpFullComplete?: boolean;
    attachedFiles?: AssignmentFile[];
    submissions?: {
      [memberId: string]: {
        submittedAt?: number;
        proofImages?: string[];
        attachedFiles?: AssignmentFile[];
        resourceLinks?: string[];
        note?: string;
        status?: string;
        feedback?: string;
        gradedBy?: string;
        marksAwarded?: number;
        maxMarks?: number;
        xpAwarded?: number;
        questionsAttempted?: number;
        questionsCorrect?: number;
        isTaskFullyCompleted?: boolean;
      };
    };
  };
  studentId: string;
  studentName: string;
  onClose: () => void;
  onGrade: (data: {
    marksAwarded: number;
    maxMarks: number;
    xpAwarded: number;
    feedback?: string;
    questionsAttempted?: number;
    questionsCorrect?: number;
    isTaskFullyCompleted: boolean;
    penaltyDeducted?: number;
  }) => Promise<void>;
  onExcuseDecision: (accepted: boolean, feedback?: string, penaltyXp?: number) => Promise<void>;
}

export const TeacherGradingModal: React.FC<TeacherGradingModalProps> = ({
  assignment,
  studentId,
  studentName,
  onClose,
  onGrade,
  onExcuseDecision
}) => {
  const submission = assignment.submissions?.[studentId];
  const isExcuse = submission?.note?.includes('Excuse:') || submission?.note?.includes('Incomplete Excuse:');
  const excuseText = submission?.note?.replace(/^(Incomplete )?Excuse:\s*/i, '') || '';

  // Has questions or not
  const totalQuestions = assignment.hasQuestions && assignment.questionsCount && assignment.questionsCount > 0
    ? assignment.questionsCount
    : (assignment.questionsCount || 0);

  // Form states
  const [isTaskFullyCompleted, setIsTaskFullyCompleted] = useState<boolean>(true);
  const [questionsAttempted, setQuestionsAttempted] = useState<string>(
    submission?.questionsAttempted !== undefined
      ? String(submission.questionsAttempted)
      : totalQuestions > 0 ? String(totalQuestions) : ''
  );
  const [questionsCorrect, setQuestionsCorrect] = useState<string>(
    submission?.questionsCorrect !== undefined
      ? String(submission.questionsCorrect)
      : totalQuestions > 0 ? String(totalQuestions) : ''
  );

  // Base XP (can be 0)
  const [baseXpReward, setBaseXpReward] = useState<number>(
    assignment.xpReward !== undefined ? assignment.xpReward : 30
  );

  // 2X XP toggle: allowed only if fully completed
  const [giveDoubleXp, setGiveDoubleXp] = useState<boolean>(
    Boolean(assignment.doubleXpFullComplete)
  );

  // Optional feedback
  const [feedback, setFeedback] = useState<string>(submission?.feedback || '');

  // Calculate default penalty if incomplete questions
  const attemptedNum = parseInt(questionsAttempted, 10) || 0;
  const correctNum = parseInt(questionsCorrect, 10) || 0;
  const isPartiallyDone = totalQuestions > 0 && (attemptedNum < totalQuestions || !isTaskFullyCompleted);

  const defaultSuggestedPenalty = useMemo(() => {
    if (!isPartiallyDone && isTaskFullyCompleted) return 0;
    if (totalQuestions > 0) {
      const missed = Math.max(0, totalQuestions - attemptedNum);
      const ratio = missed / totalQuestions;
      // Suggested penalty between 10 and 50 XP based on assignment XP
      return Math.min(60, Math.max(5, Math.round((assignment.xpReward || 30) * ratio * 0.8)));
    }
    return !isTaskFullyCompleted ? 15 : 0;
  }, [isPartiallyDone, isTaskFullyCompleted, totalQuestions, attemptedNum, assignment.xpReward]);

  const [penaltyXp, setPenaltyXp] = useState<number>(defaultSuggestedPenalty);
  const [applyPenalty, setApplyPenalty] = useState<boolean>(isPartiallyDone);

  // Excuse review specific state
  const [excuseDecision, setExcuseDecision] = useState<'accept' | 'reject'>('accept');
  const [excusePenalty, setExcusePenalty] = useState<number>(
    Math.round((assignment.xpReward || 30) * 0.5) || 15
  );

  const [submitting, setSubmitting] = useState<boolean>(false);

  // Computed net XP to be awarded
  const netXp = useMemo(() => {
    let earned = baseXpReward;
    if (giveDoubleXp && isTaskFullyCompleted && (totalQuestions === 0 || attemptedNum >= totalQuestions)) {
      earned = earned * 2;
    }
    if (applyPenalty && penaltyXp > 0) {
      earned = Math.max(0, earned - penaltyXp);
    }
    return earned;
  }, [baseXpReward, giveDoubleXp, isTaskFullyCompleted, totalQuestions, attemptedNum, applyPenalty, penaltyXp]);

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onGrade({
        marksAwarded: correctNum,
        maxMarks: totalQuestions || 10,
        xpAwarded: netXp,
        feedback: feedback.trim(),
        questionsAttempted: totalQuestions > 0 ? attemptedNum : undefined,
        questionsCorrect: totalQuestions > 0 ? correctNum : undefined,
        isTaskFullyCompleted,
        penaltyDeducted: applyPenalty ? penaltyXp : 0
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcuseSubmit = async () => {
    setSubmitting(true);
    try {
      if (excuseDecision === 'accept') {
        await onExcuseDecision(true, feedback.trim(), 0);
      } else {
        await onExcuseDecision(false, feedback.trim(), excusePenalty);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to open Data URLs / Blob URLs safely in a new tab without about:blank browser block
  const openDataUrlInNewTab = (dataUrl: string, fileName: string = 'homework_attachment') => {
    if (!dataUrl) return;
    if (dataUrl.startsWith('data:')) {
      try {
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1] || '');
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        if (!win) {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          a.click();
        }
        return;
      } catch (e) {
        console.error('Failed to convert dataUrl to blob', e);
      }
    }
    window.open(dataUrl, '_blank');
  };

  // Lightbox preview for images
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const getFileIcon = (type: AssignmentFile['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-indigo-400" />;
      case 'link':
        return <LinkIcon className="w-4 h-4 text-cyan-400" />;
      default:
        return <FileText className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Lightbox Modal for Full Resolution Image Viewing */}
      {selectedPreviewImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4 animate-fadeIn">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => openDataUrlInNewTab(selectedPreviewImage.url, selectedPreviewImage.title)}
              className="px-3 py-1.5 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md hover:bg-amber-300"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Original File</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPreviewImage(null)}
              className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-w-4xl max-h-[85vh] overflow-auto p-2">
            <img
              src={selectedPreviewImage.url}
              alt={selectedPreviewImage.title}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain mx-auto shadow-2xl border border-zinc-800"
            />
            <p className="text-center text-xs text-zinc-400 mt-2 font-medium">{selectedPreviewImage.title}</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl surface-card rounded-3xl p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto animate-modal border-amber-500/30">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 text-[10px] font-bold border border-amber-400/30 uppercase">
                {isExcuse ? 'Faculty Excuse Review' : 'Faculty Homework Grading'}
              </span>
              <span className="text-xs text-zinc-400 font-mono-num">• Due: {assignment.dueDate}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white font-display">
              {studentName}'s Submission for "{assignment.title}"
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
              <span className="text-white font-semibold">{assignment.subject}</span>
              {totalQuestions > 0 && (
                <span>• Drill: {totalQuestions} Questions ({assignment.questionDifficulty || 'medium'})</span>
              )}
              <span>• Base XP: +{assignment.xpReward} XP</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Graded Status & Faculty Override Indicator */}
        {!isExcuse && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-violet-500/15 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-400 text-zinc-950 font-bold shrink-0 shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">
                    {submission?.status === 'graded' ? '🤖 Automatically Graded by AI Evaluator' : '🤖 AI Evaluator Ready'}
                  </span>
                  <span className="px-2 py-0.2 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                    Faculty Editable
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Homework was automatically evaluated by AI upon student submission. Faculty/Admin can check and override marks, XP, or feedback below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Student Submission Materials / Proofs */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>📁 Student Solution Files, Handwritten Proofs & Photos</span>
              <span className="text-zinc-500 font-mono-num font-normal">
                ({(submission?.attachedFiles || []).length + (submission?.proofImages || []).length} items)
              </span>
            </span>
          </div>

          {/* Files & Photos Inline Gallery */}
          {((submission?.attachedFiles && submission.attachedFiles.length > 0) ||
            (submission?.proofImages && submission.proofImages.length > 0)) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(submission?.attachedFiles || []).map((file, i) => {
                const isImg = file.type === 'image' || (file.url && file.url.startsWith('data:image'));
                return (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1.5 rounded-lg bg-zinc-800 shrink-0">
                          {getFileIcon(file.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-zinc-200 font-medium truncate" title={file.name}>
                            {file.name}
                          </p>
                          <span className="text-[10px] text-zinc-500 uppercase font-mono">
                            {file.type} {file.size ? `• ${file.size}` : ''}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openDataUrlInNewTab(file.url, file.name)}
                        className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-[10px] flex items-center gap-1 shrink-0 transition-colors"
                        title="View / Download File"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open</span>
                      </button>
                    </div>

                    {/* Inline Image Preview if file is an image */}
                    {isImg && file.url && (
                      <div
                        onClick={() => setSelectedPreviewImage({ url: file.url, title: file.name })}
                        className="cursor-pointer group relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video max-h-36 flex items-center justify-center"
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold gap-1">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Click to Zoom</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(submission?.proofImages || []).map((imgUrl, i) => (
                <div
                  key={`img_${i}`}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-zinc-200 font-medium truncate block">Solution Page #{i + 1}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => openDataUrlInNewTab(imgUrl, `solution_photo_${i + 1}.jpg`)}
                      className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-[10px] flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open</span>
                    </button>
                  </div>

                  <div
                    onClick={() => setSelectedPreviewImage({ url: imgUrl, title: `Solution Page #${i + 1}` })}
                    className="cursor-pointer group relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video max-h-36 flex items-center justify-center"
                  >
                    <img
                      src={imgUrl}
                      alt={`Solution ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold gap-1">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Click to Zoom</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">No files or photo solutions were attached by the student.</p>
          )}

          {/* Student External Resource Links */}
          {submission?.resourceLinks && submission.resourceLinks.length > 0 && (
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 block">
                Student External Resource Links ({submission.resourceLinks.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {submission.resourceLinks.map((linkUrl, idx) => (
                  <a
                    key={idx}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-1.5 transition-all"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="truncate max-w-[200px] font-medium">{linkUrl}</span>
                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Student's Note / Excuse Statement */}
          {submission?.note && (
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                {isExcuse ? 'Student Excuse Statement:' : 'Student Submission Note:'}
              </span>
              <p className="text-xs text-zinc-200 italic leading-relaxed">
                "{isExcuse ? excuseText : submission.note}"
              </p>
            </div>
          )}
        </div>

        {/* DECISION VIEW A: EXCUSE REVIEW */}
        {isExcuse ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Shield className="w-4 h-4" />
                <span>Excuse Resolution Decision</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Review whether the student's excuse is acceptable (e.g. sickness, school exams). If accepted, no penalty is applied. If rejected, an XP penalty is deducted.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setExcuseDecision('accept')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    excuseDecision === 'accept'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Accept Excuse (0 XP Penalty)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExcuseDecision('reject')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    excuseDecision === 'reject'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Reject Excuse (Apply Penalty)</span>
                </button>
              </div>

              {excuseDecision === 'reject' && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-rose-500/30 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-300">XP Penalty to Deduct:</span>
                    <span className="text-[10px] text-zinc-400">Defaults to 50% of assignment, adjustable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={excusePenalty}
                      onChange={(e) => setExcusePenalty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-24 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white font-mono-num font-bold text-xs"
                    />
                    <span className="text-xs text-rose-400 font-bold font-mono-num">-{excusePenalty} XP</span>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Feedback */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Teacher Feedback to Student (Optional):</span>
                <span className="text-[10px] text-zinc-500">Student will see this</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Excuse noted, please submit by next Tuesday..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-xs font-semibold hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleExcuseSubmit}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <span>Confirm Excuse Decision</span>
              </button>
            </div>
          </div>
        ) : (
          /* DECISION VIEW B: STANDARD HOMEWORK GRADING */
          <form onSubmit={handleGradeSubmit} className="space-y-4">
            {/* Step 1: Task Completion Status */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <label className="text-xs font-bold text-white flex items-center justify-between">
                <span>Has the student fully completed the assignment task?</span>
                <span className={`text-[11px] font-bold ${isTaskFullyCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isTaskFullyCompleted ? '✓ Fully Completed' : '⏳ Incomplete / Partial'}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsTaskFullyCompleted(true);
                    setApplyPenalty(false);
                  }}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    isTaskFullyCompleted
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  Yes, Fully Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTaskFullyCompleted(false);
                    setGiveDoubleXp(false); // 2X XP only for fully done!
                    setApplyPenalty(true);
                  }}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    !isTaskFullyCompleted
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  No, Incomplete / Half Done
                </button>
              </div>
            </div>

            {/* Step 2: Questions Breakdown (if questions were assigned or given) */}
            {totalQuestions > 0 && (
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Questions Verification ({totalQuestions} assigned):</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono-num">
                    Difficulty: {assignment.questionDifficulty || 'Medium'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-1">How many questions did student DO?</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={totalQuestions}
                        value={questionsAttempted}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestionsAttempted(val);
                          const num = parseInt(val, 10) || 0;
                          if (num < totalQuestions) {
                            setIsTaskFullyCompleted(false);
                            setGiveDoubleXp(false);
                            setApplyPenalty(true);
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono-num font-bold text-xs"
                      />
                      <span className="text-xs text-zinc-500 font-mono-num">/ {totalQuestions}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-1">How many did they do CORRECTLY?</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={attemptedNum || totalQuestions}
                        value={questionsCorrect}
                        onChange={(e) => setQuestionsCorrect(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono-num font-bold text-xs"
                      />
                      <span className="text-xs text-zinc-500 font-mono-num">/ {attemptedNum || totalQuestions}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Incomplete penalty review prompt (if incomplete or partially done) */}
            {(!isTaskFullyCompleted || (totalQuestions > 0 && attemptedNum < totalQuestions)) && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Incomplete Homework XP Deduction Prompt</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-zinc-300">
                    <input
                      type="checkbox"
                      checked={applyPenalty}
                      onChange={(e) => setApplyPenalty(e.target.checked)}
                      className="rounded accent-rose-500"
                    />
                    <span>Deduct XP Penalty</span>
                  </label>
                </div>

                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  The student completed {attemptedNum} of {totalQuestions || 'all'} questions. We suggest deducting{' '}
                  <strong className="text-rose-400 font-mono-num">{defaultSuggestedPenalty} XP</strong> by default.
                  You can modify this amount below (0 included):
                </p>

                {applyPenalty && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-zinc-400">Deduct Penalty:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={penaltyXp}
                      onChange={(e) => setPenaltyXp(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-24 px-3 py-1.5 rounded-xl bg-zinc-900 border border-rose-500/40 text-white font-mono-num font-bold text-xs"
                    />
                    <span className="text-xs font-bold text-rose-400 font-mono-num">-{penaltyXp} XP</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: XP Configuration & 2X XP Multiplier */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>XP Reward Allocation (0 XP is an option):</span>
                </span>
                <span className="text-xs font-bold text-amber-400 font-mono-num">
                  Net to Student: +{netXp} XP
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Base Assignment XP Reward:</label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={baseXpReward}
                    onChange={(e) => setBaseXpReward(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono-num font-bold text-xs"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">0 XP allowed</span>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">2X XP Completion Boost:</label>
                  <button
                    type="button"
                    disabled={!isTaskFullyCompleted || (totalQuestions > 0 && attemptedNum < totalQuestions)}
                    onClick={() => setGiveDoubleXp(!giveDoubleXp)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                      giveDoubleXp && isTaskFullyCompleted
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Grant 2X XP ({baseXpReward * 2} XP)</span>
                    </span>
                    <span>{giveDoubleXp && isTaskFullyCompleted ? 'ACTIVE' : 'OFF'}</span>
                  </button>
                  {(!isTaskFullyCompleted || (totalQuestions > 0 && attemptedNum < totalQuestions)) && (
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                      * 2X XP is unlocked only when all questions & task are fully completed.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Step 5: Optional Feedback to Student */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Teacher Feedback & Guidance (Optional):</span>
                <span className="text-[10px] text-zinc-500">Visible to student on their homework desk</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Excellent step presentation on problem 4. Re-check trigonometry sign conventions..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-300 text-xs font-semibold hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <span>Save Grades & Award +{netXp} XP</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
