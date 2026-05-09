import { useState } from 'react';
import { MessageCircle, X, Check, Send, ChevronDown, ChevronUp } from 'lucide-react';
import useStore from '../../store/useStore';

export default function CommentOverlay() {
    const { comments, nodes, stagePosition, stageScale, addReply, resolveComment, deleteComment, theme } = useStore();
    const isDark = theme === 'dark';
    const [openCommentId, setOpenCommentId] = useState(null);
    const [replyText, setReplyText] = useState('');

    if (comments.length === 0) return null;

    const getCommentPosition = (comment) => {
        let x = comment.x;
        let y = comment.y;

        // If attached to a node, follow the node's position
        if (comment.parentNodeId) {
            const node = nodes.find(n => n.id === comment.parentNodeId);
            if (node) {
                x = (node.x || 0) + (comment.x || 20);
                y = (node.y || 0) + (comment.y || -20);
            }
        }

        // Convert canvas coordinates to screen coordinates
        const screenX = x * stageScale + stagePosition.x;
        const screenY = y * stageScale + stagePosition.y;
        return { screenX, screenY };
    };

    const handleReply = (commentId) => {
        if (replyText.trim()) {
            addReply(commentId, replyText.trim());
            setReplyText('');
        }
    };

    return (
        <>
            {comments.map(comment => {
                const { screenX, screenY } = getCommentPosition(comment);
                const isOpen = openCommentId === comment.id;

                return (
                    <div key={comment.id} className="fixed z-[60]" style={{ left: screenX - 12, top: screenY - 12 }}>
                        {/* Pin */}
                        <button
                            onClick={() => setOpenCommentId(isOpen ? null : comment.id)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${comment.resolved
                                ? 'bg-green-500'
                                : 'bg-orange-500'
                                }`}
                            title={comment.text}
                        >
                            <MessageCircle className="w-3.5 h-3.5 text-white" />
                        </button>

                        {/* Thread popover */}
                        {isOpen && (
                            <div
                                className={`absolute left-8 top-0 rounded-xl shadow-2xl border w-72 z-[61] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className={`flex items-center justify-between px-3 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                                    <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Comment {comment.resolved && '(Resolved)'}
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => resolveComment(comment.id)}
                                            className={`p-1 rounded transition-colors ${comment.resolved ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                            title={comment.resolved ? 'Unresolve' : 'Resolve'}
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => { deleteComment(comment.id); setOpenCommentId(null); }}
                                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Delete"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Main comment */}
                                <div className={`px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {comment.text}
                                    <div className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {new Date(comment.createdAt).toLocaleString()}
                                    </div>
                                </div>

                                {/* Replies */}
                                {comment.replies.length > 0 && (
                                    <div className={`border-t px-3 py-1.5 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                                        {comment.replies.map(reply => (
                                            <div key={reply.id} className={`py-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {reply.text}
                                                <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {new Date(reply.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Reply input */}
                                <div className={`border-t px-2 py-2 flex gap-1.5 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                                    <input
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { handleReply(comment.id); }
                                            e.stopPropagation();
                                        }}
                                        placeholder="Reply..."
                                        className={`flex-1 text-sm px-2 py-1 rounded-lg border outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-black placeholder-gray-400'}`}
                                    />
                                    <button
                                        onClick={() => handleReply(comment.id)}
                                        className="px-2 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}
