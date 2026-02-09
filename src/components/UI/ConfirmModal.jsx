import { createPortal } from 'react-dom';

export default function ConfirmModal({ isOpen, message, onConfirm, onCancel }) {
    if (!isOpen) return null;

    return createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999
            }}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }}
                onClick={onCancel}
            />

            {/* Modal */}
            <div
                style={{
                    position: 'relative',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '24px',
                    minWidth: '320px',
                    maxWidth: '400px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                <p style={{
                    color: '#1f2937',
                    textAlign: 'center',
                    fontSize: '18px',
                    marginBottom: '24px',
                    margin: '0 0 24px 0'
                }}>
                    {message}
                </p>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 24px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            fontWeight: '500',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
                    >
                        Yes
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 24px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            fontWeight: '500',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
                    >
                        No
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
