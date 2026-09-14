'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  AtSign,
  Send,
  Info,
  RefreshCw,
  X,
  Search,
  Check,
  UserCheck,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { AvatarChip } from '../ui/AvatarChip';

export type CommentType = 'GENERAL' | 'CHANGE' | 'INFO';

export interface CommentUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  designation?: string | null;
}

export interface ParsedComment {
  id: string;
  body: string;
  rawBody: string;
  type: CommentType;
  taggedUsers: CommentUser[];
  author: {
    id: string;
    name: string;
    email?: string;
    role?: string;
    designation?: string | null;
  };
  createdAt: string;
}

export interface CommentThreadProps {
  projectId: string;
  taskId?: string | null;
  comments: any[];
  availableUsers?: CommentUser[];
  projectMembers?: any[];
  onCommentPosted?: () => void;
  title?: string;
  placeholder?: string;
}

/**
 * Utility to parse structured metadata and body text from comment string
 */
export function parseComment(comment: any): ParsedComment {
  if (!comment) {
    return {
      id: '',
      body: '',
      rawBody: '',
      type: 'GENERAL',
      taggedUsers: [],
      author: { id: '', name: 'Unknown', role: 'EMPLOYEE' },
      createdAt: new Date().toISOString(),
    };
  }

  const raw = comment.body || '';
  let type: CommentType = 'GENERAL';
  let taggedUsers: CommentUser[] = [];
  let cleanBody = raw;

  // Check for <!--meta:...--> header
  const metaMatch = raw.match(/^<!--meta:(\{.*?\})-->\s*\n?/);
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1]);
      if (meta.type && ['GENERAL', 'CHANGE', 'INFO'].includes(meta.type)) {
        type = meta.type as CommentType;
      }
      if (Array.isArray(meta.taggedUsers)) {
        taggedUsers = meta.taggedUsers;
      }
      cleanBody = raw.slice(metaMatch[0].length);
    } catch (e) {
      console.error('Failed to parse comment meta:', e);
    }
  }

  return {
    id: comment.id,
    body: cleanBody,
    rawBody: raw,
    type,
    taggedUsers,
    author: comment.author || { id: '', name: 'User', role: 'EMPLOYEE' },
    createdAt: comment.createdAt,
  };
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  projectId,
  taskId = null,
  comments = [],
  availableUsers = [],
  projectMembers = [],
  onCommentPosted,
  title = 'Comments & Project Communication',
  placeholder = 'Share project updates, state changes, or info with colleagues...',
}) => {
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('GENERAL');
  const [selectedTaggedUsers, setSelectedTaggedUsers] = useState<CommentUser[]>([]);
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Inline @ mention trigger state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userPickerRef = useRef<HTMLDivElement>(null);

  // Combine and deduplicate users
  const allCandidateUsers = React.useMemo(() => {
    const map = new Map<string, CommentUser>();

    // Add project members first
    projectMembers.forEach((m) => {
      const u = m.user || m;
      if (u?.id) {
        map.set(u.id, {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          designation: u.designation,
        });
      }
    });

    // Add available department/system users
    availableUsers.forEach((u) => {
      if (u?.id && !map.has(u.id)) {
        map.set(u.id, {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          designation: u.designation,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projectMembers, availableUsers]);

  // Filtered users for user picker popover
  const filteredCandidateUsers = React.useMemo(() => {
    if (!userSearchQuery.trim()) return allCandidateUsers;
    const q = userSearchQuery.toLowerCase();
    return allCandidateUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
    );
  }, [allCandidateUsers, userSearchQuery]);

  // Filtered users for inline @ mention autocomplete
  const inlineMentionCandidates = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return allCandidateUsers
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allCandidateUsers, mentionQuery]);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setIsUserPickerOpen(false);
      }
    };
    if (isUserPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserPickerOpen]);

  // Detect typing of '@' in textarea for inline mentions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    setCommentText(text);

    // Look backwards from cursor for '@' symbol
    const textBeforeCursor = text.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      // Valid mention query if no newline and max 30 chars
      if (!query.includes('\n') && !query.includes(' ') && query.length <= 30) {
        setMentionQuery(query);
        setMentionPosition({ start: lastAtIndex, end: cursor });
        return;
      }
    }

    setMentionQuery(null);
    setMentionPosition(null);
  };

  const handleSelectInlineMention = (user: CommentUser) => {
    if (!mentionPosition || !textareaRef.current) return;

    const before = commentText.slice(0, mentionPosition.start);
    const after = commentText.slice(mentionPosition.end);
    const newText = `${before}@${user.name} ${after}`;

    setCommentText(newText);
    setMentionQuery(null);
    setMentionPosition(null);

    // Add user to selected tagged users list if not already present
    if (!selectedTaggedUsers.some((u) => u.id === user.id)) {
      setSelectedTaggedUsers((prev) => [...prev, user]);
    }

    // Set cursor after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const nextPos = mentionPosition.start + user.name.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const toggleUserTag = (user: CommentUser) => {
    setSelectedTaggedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const removeUserTag = (userId: string) => {
    setSelectedTaggedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleTagAllMembers = () => {
    setSelectedTaggedUsers(allCandidateUsers);
  };

  const handleClearTags = () => {
    setSelectedTaggedUsers([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const targetEndpoint = taskId ? `/api/tasks/${taskId}/comments` : `/api/tasks/project/comments`;
      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          body: commentText,
          taggedUserIds: selectedTaggedUsers.map((u) => u.id),
          commentType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to post comment');
      }

      // Reset input form
      setCommentText('');
      setSelectedTaggedUsers([]);
      setCommentType('GENERAL');
      setIsUserPickerOpen(false);

      if (onCommentPosted) {
        onCommentPosted();
      }
    } catch (err: any) {
      console.error('Submit comment error:', err);
      setErrorMessage(err.message || 'Error posting comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render text with styled mention highlights
  const renderFormattedText = (text: string) => {
    const mentionRegex = /(@[a-zA-Z0-9_\s.]+?)(?=[.,!?:;\s]|$)/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#5e6ad2]/20 text-[#a5b4fc] border border-[#5e6ad2]/30 mx-0.5"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-6">
      {/* Post Comment Container */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-[#101114] hairline-border rounded-xl space-y-3.5 shadow-lg relative"
      >
        {/* Header & Classification Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 hairline-b pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-[#5e6ad2]" />
            <span className="text-xs font-semibold text-gray-200">{title}</span>
          </div>

          {/* Comment Type Intent Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-[#0c0d0f] hairline-border rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setCommentType('GENERAL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                commentType === 'GENERAL'
                  ? 'bg-white/10 text-white shadow-sm font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              💬 General
            </button>
            <button
              type="button"
              onClick={() => setCommentType('CHANGE')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                commentType === 'CHANGE'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-amber-300'
              }`}
              title="State project changes, scope updates, or revisions"
            >
              <RefreshCw size={11} className={commentType === 'CHANGE' ? 'animate-spin-once' : ''} />
              🔄 Project Change
            </button>
            <button
              type="button"
              onClick={() => setCommentType('INFO')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                commentType === 'INFO'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-sky-300'
              }`}
              title="Share important notices, instructions, or documentation"
            >
              <Info size={11} />
              ℹ️ Important Info
            </button>
          </div>
        </div>

        {/* Change / Info Banner Guidance */}
        {commentType === 'CHANGE' && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-[11px] text-amber-200/90 animate-in fade-in">
            <RefreshCw size={13} className="shrink-0 text-amber-400" />
            <span>
              <strong>Project Change Notice:</strong> Tagged colleagues and project members will be alerted that a specification or project change has been declared.
            </span>
          </div>
        )}
        {commentType === 'INFO' && (
          <div className="flex items-center gap-2 p-2.5 bg-sky-500/10 border border-sky-500/25 rounded-lg text-[11px] text-sky-200/90 animate-in fade-in">
            <Info size={13} className="shrink-0 text-sky-400" />
            <span>
              <strong>Information Update:</strong> Tagged colleagues and team members will receive a highlighted project briefing notification.
            </span>
          </div>
        )}

        {/* Textarea with Inline @ Autocomplete */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            required
            rows={3}
            value={commentText}
            onChange={handleTextChange}
            placeholder={
              commentType === 'CHANGE'
                ? 'Describe the project change, updated requirements, or revised timeline (type @ to tag colleagues)...'
                : commentType === 'INFO'
                ? 'Share critical project info, guidelines, or instructions (type @ to tag colleagues)...'
                : placeholder
            }
            className="w-full bg-[#0c0d0f] hairline-border text-xs text-gray-100 p-3 rounded-lg focus:outline-none focus:border-[#5e6ad2] transition-colors leading-relaxed placeholder:text-gray-500"
          />

          {/* Inline @ Mention Popup Menu */}
          {inlineMentionCandidates.length > 0 && (
            <div className="absolute left-2 bottom-full mb-1 z-30 w-72 bg-[#18191d] hairline-border rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-gray-400 flex items-center gap-1.5">
                <AtSign size={10} className="text-[#5e6ad2]" /> Matching Colleagues
              </div>
              {inlineMentionCandidates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectInlineMention(u)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-[#5e6ad2]/20 rounded-lg flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-[#5e6ad2]/30 text-[#a5b4fc] flex items-center justify-center font-bold text-[10px] shrink-0">
                      {u.name[0]?.toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-gray-200 group-hover:text-white font-medium text-xs truncate block">
                        {u.name}
                      </span>
                      {u.designation && (
                        <span className="text-[10px] text-gray-400 truncate block">
                          {u.designation}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Tagged Users Chips Bar */}
        {selectedTaggedUsers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#0c0d0f] hairline-border rounded-lg animate-in fade-in">
            <span className="text-[10px] uppercase font-semibold text-gray-400 flex items-center gap-1 mr-1">
              <Tag size={10} className="text-[#5e6ad2]" /> Tagged ({selectedTaggedUsers.length}):
            </span>
            {selectedTaggedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#5e6ad2]/20 text-[#a5b4fc] border border-[#5e6ad2]/40 text-[11px] font-medium"
              >
                <span>@{u.name}</span>
                <button
                  type="button"
                  onClick={() => removeUserTag(u.id)}
                  className="p-0.5 hover:text-white rounded-full hover:bg-white/10"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearTags}
              className="text-[10px] text-gray-500 hover:text-red-400 ml-auto transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="text-xs text-red-400 flex items-center gap-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle size={13} /> {errorMessage}
          </div>
        )}

        {/* Action Controls & Tag Users Trigger */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Tag Users Popover Button */}
          <div className="relative" ref={userPickerRef}>
            <button
              type="button"
              onClick={() => setIsUserPickerOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTaggedUsers.length > 0
                  ? 'bg-[#5e6ad2]/20 text-[#a5b4fc] border border-[#5e6ad2]/40'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 hairline-border'
              }`}
            >
              <AtSign size={13} className="text-[#5e6ad2]" />
              <span>Tag Users</span>
              {selectedTaggedUsers.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#5e6ad2] text-white text-[9px] font-bold flex items-center justify-center">
                  {selectedTaggedUsers.length}
                </span>
              )}
            </button>

            {/* Tag Users Dropdown Menu */}
            {isUserPickerOpen && (
              <div className="absolute left-0 bottom-full mb-2 z-40 w-80 bg-[#14161a] hairline-border rounded-xl shadow-2xl p-3 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between hairline-b pb-2">
                  <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <UserCheck size={13} className="text-[#5e6ad2]" /> Tag Specific Colleagues
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTagAllMembers}
                      className="text-[10px] text-[#a5b4fc] hover:underline font-medium"
                    >
                      Tag All
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUserPickerOpen(false)}
                      className="p-1 text-gray-400 hover:text-white rounded"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Search in user picker */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-gray-500" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name, role, or title..."
                    className="w-full bg-[#0c0d0f] hairline-border text-xs text-gray-200 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-[#5e6ad2]"
                  />
                </div>

                {/* User List */}
                <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredCandidateUsers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-500">No users found</div>
                  ) : (
                    filteredCandidateUsers.map((u) => {
                      const isSelected = selectedTaggedUsers.some((sel) => sel.id === u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleUserTag(u)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#5e6ad2]/20 border border-[#5e6ad2]/40'
                              : 'hover:bg-white/5 hairline-border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {u.name[0]?.toUpperCase()}
                            </div>
                            <div className="truncate">
                              <p className="text-gray-200 font-medium truncate">{u.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">
                                {u.designation || u.role}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-[#5e6ad2] border-[#5e6ad2] text-white'
                                : 'border-gray-600 bg-black/40'
                            }`}
                          >
                            {isSelected && <Check size={10} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#5e6ad2] hover:bg-[#4e5ac0] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition-all active:scale-95"
            >
              <Send size={12} className={isSubmitting ? 'animate-pulse' : ''} />
              <span>{isSubmitting ? 'Posting...' : 'Post Comment'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Rendered Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="p-8 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
            <MessageSquare size={24} className="text-gray-600 mx-auto" />
            <h4 className="text-xs font-semibold text-gray-300">No Comments Yet</h4>
            <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
              Start the discussion, share project information, or tag colleagues to state a project change.
            </p>
          </div>
        ) : (
          comments.map((rawComment) => {
            const c = parseComment(rawComment);
            const isChange = c.type === 'CHANGE';
            const isInfo = c.type === 'INFO';

            return (
              <div
                key={c.id}
                className={`p-4 bg-[#101114] rounded-xl space-y-2.5 text-xs transition-all ${
                  isChange
                    ? 'border border-amber-500/35 bg-gradient-to-r from-amber-500/5 to-transparent'
                    : isInfo
                    ? 'border border-sky-500/35 bg-gradient-to-r from-sky-500/5 to-transparent'
                    : 'hairline-border'
                }`}
              >
                {/* Comment Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AvatarChip
                      name={c.author?.name}
                      designation={c.author?.designation}
                      size="sm"
                    />
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white/10 text-gray-300 font-mono">
                      {c.author?.role}
                    </span>

                    {/* Announcement Classification Badge */}
                    {isChange && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                        <RefreshCw size={10} />
                        Project Change
                      </span>
                    )}
                    {isInfo && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1 shadow-sm">
                        <Info size={10} />
                        Project Info
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-gray-500 font-mono">
                    {new Date(c.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Tagged Colleagues Strip */}
                {c.taggedUsers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-7 pt-0.5">
                    <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                      <AtSign size={10} className="text-[#5e6ad2]" /> Tagged:
                    </span>
                    {c.taggedUsers.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#5e6ad2]/15 text-[#a5b4fc] text-[10px] font-medium border border-[#5e6ad2]/30"
                      >
                        @{u.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Comment Body */}
                <div className="text-gray-200 pl-7 leading-relaxed whitespace-pre-wrap">
                  {renderFormattedText(c.body)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
