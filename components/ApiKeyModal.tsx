import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Space, Alert, List, Tag, Popconfirm, message } from 'antd';
import { DeleteOutlined, ReloadOutlined, PlusOutlined, KeyOutlined } from '@ant-design/icons';
import { apiKeyManager, type ApiKeyInfo } from '../services/apiKeyManager';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
    const [apiKeys, setApiKeys] = useState<string[]>(['']);
    const [savedKeys, setSavedKeys] = useState<ApiKeyInfo[]>([]);
    const [loading, setLoading] = useState(false);

    // Load keys khi modal mở
    useEffect(() => {
        if (isOpen) {
            apiKeyManager.initialize();
            const keys = apiKeyManager.getAllKeys();
            setSavedKeys(keys);
            // Hiển thị keys hiện tại trong input
            if (keys.length > 0) {
                setApiKeys(keys.map(k => k.key));
            } else {
                setApiKeys(['']);
            }
        }
    }, [isOpen]);

    const handleAddInput = () => {
        setApiKeys([...apiKeys, '']);
    };

    const handleRemoveInput = (index: number) => {
        if (apiKeys.length > 1) {
            setApiKeys(apiKeys.filter((_, i) => i !== index));
        }
    };

    const handleKeyChange = (index: number, value: string) => {
        const newKeys = [...apiKeys];
        newKeys[index] = value;
        setApiKeys(newKeys);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Validate
            const validKeys = apiKeys.filter(k => k.trim().length > 0);
            if (validKeys.length === 0) {
                message.error('Vui lòng nhập ít nhất một API key');
                return;
            }

            // Validate format
            const suspiciousKeys = validKeys.filter(k => k.length < 20 || k.length > 200);
            if (suspiciousKeys.length > 0) {
                message.error('Một hoặc nhiều API keys có độ dài không hợp lệ. API key Gemini thường có độ dài từ 20-200 ký tự.');
                return;
            }

            apiKeyManager.setKeys(validKeys);
            const updatedKeys = apiKeyManager.getAllKeys();
            setSavedKeys(updatedKeys);
            notification.success({
              message: 'Đã lưu API keys',
              description: `Đã lưu ${validKeys.length} API key(s) thành công!`,
              icon: <CheckCircleOutlined style={{ color: '#7951d4' }} />,
              placement: 'topRight',
              duration: 3,
            });
            
            // Clear input sau khi lưu
            setTimeout(() => {
                setApiKeys(updatedKeys.map(k => k.key));
            }, 500);
        } catch (err: any) {
            const errorMsg = err.message || 'Lỗi khi lưu API keys';
            notification.error({
              message: 'Lỗi khi lưu API keys',
              description: errorMsg,
              icon: <CloseCircleOutlined />,
              placement: 'topRight',
              duration: 4,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveSavedKey = (key: string) => {
        apiKeyManager.removeKey(key);
        const updatedKeys = apiKeyManager.getAllKeys();
        setSavedKeys(updatedKeys);
        // Cập nhật input
        if (updatedKeys.length > 0) {
            setApiKeys(updatedKeys.map(k => k.key));
        } else {
            setApiKeys(['']);
        }
        notification.success({
          message: 'Đã xóa API key',
          description: 'API key đã được xóa khỏi danh sách.',
          icon: <CheckCircleOutlined style={{ color: '#7951d4' }} />,
          placement: 'topRight',
          duration: 2,
        });
    };

    const handleResetExhausted = (key: string) => {
        apiKeyManager.resetKeyExhausted(key);
        const updatedKeys = apiKeyManager.getAllKeys();
        setSavedKeys(updatedKeys);
        notification.success({
          message: 'Đã reset trạng thái',
          description: 'Trạng thái "hết quota" của API key đã được reset.',
          icon: <CheckCircleOutlined style={{ color: '#7951d4' }} />,
          placement: 'topRight',
          duration: 2,
        });
    };

    const handleResetAll = () => {
        apiKeyManager.resetAllKeys();
        const updatedKeys = apiKeyManager.getAllKeys();
        setSavedKeys(updatedKeys);
        notification.success({
          message: 'Đã reset tất cả API keys',
          description: 'Tất cả trạng thái "hết quota" đã được reset.',
          icon: <CheckCircleOutlined style={{ color: '#7951d4' }} />,
          placement: 'topRight',
          duration: 3,
        });
    };

    return (
        <Modal
            title={
                <Space>
                    <KeyOutlined />
                    <span>Quản lý API Keys</span>
                </Space>
            }
            open={isOpen}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Đóng
                </Button>,
                <Button key="save" type="primary" onClick={handleSave} loading={loading}>
                    Lưu API Keys
                </Button>,
            ]}
            styles={{
                body: { maxHeight: '70vh', overflowY: 'auto' }
            }}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Input section */}
                <div>
                    <div style={{ marginBottom: 12, fontWeight: 500 }}>
                        Nhập API Keys
                    </div>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {apiKeys.map((key, index) => (
                            <Space key={index} style={{ width: '100%' }}>
                                <Input.Password
                                    value={key}
                                    onChange={(e) => handleKeyChange(index, e.target.value)}
                                    placeholder={`API Key ${index + 1}`}
                                    style={{ flex: 1 }}
                                />
                                {apiKeys.length > 1 && (
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleRemoveInput(index)}
                                    />
                                )}
                            </Space>
                        ))}
                        <Button
                            icon={<PlusOutlined />}
                            onClick={handleAddInput}
                            block
                        >
                            Thêm API Key
                        </Button>
                    </Space>
                </div>

                {/* Saved keys section */}
                {savedKeys.length > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontWeight: 500 }}>
                                API Keys đã lưu ({savedKeys.length})
                            </div>
                            <Button
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={handleResetAll}
                            >
                                Reset tất cả
                            </Button>
                        </div>
                        <List
                            dataSource={savedKeys}
                            renderItem={(keyInfo, index) => (
                                <List.Item
                                    style={{
                                        backgroundColor: keyInfo.isExhausted ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                        border: `1px solid ${keyInfo.isExhausted ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                                        borderRadius: 8,
                                        padding: 12,
                                        marginBottom: 8,
                                    }}
                                >
                                    <List.Item.Meta
                                        title={
                                            <Space>
                                                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                                    {keyInfo.key.substring(0, 20)}...
                                                </span>
                                                {keyInfo.isExhausted && (
                                                    <Tag color="error">Đã hết quota/pro</Tag>
                                                )}
                                            </Space>
                                        }
                                        description={
                                            keyInfo.lastError && (
                                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                                                    {keyInfo.lastError}
                                                </div>
                                            )
                                        }
                                    />
                                    <Space>
                                        {keyInfo.isExhausted && (
                                            <Button
                                                size="small"
                                                icon={<ReloadOutlined />}
                                                onClick={() => handleResetExhausted(keyInfo.key)}
                                            >
                                                Reset
                                            </Button>
                                        )}
                                        <Popconfirm
                                            title="Xóa API key này?"
                                            onConfirm={() => handleRemoveSavedKey(keyInfo.key)}
                                            okText="Xóa"
                                            cancelText="Hủy"
                                        >
                                            <Button
                                                danger
                                                size="small"
                                                icon={<DeleteOutlined />}
                                            />
                                        </Popconfirm>
                                    </Space>
                                </List.Item>
                            )}
                        />
                    </div>
                )}

                {/* Info section */}
                <Alert
                    message="Hướng dẫn"
                    description={
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                            <li>Nhập nhiều API keys để tự động xoay vòng khi một key hết quota</li>
                            <li>Khi tất cả keys hết pro/quota, hệ thống sẽ tự động chuyển sang model Flash</li>
                            <li>API keys được lưu trữ cục bộ trong trình duyệt của bạn</li>
                            <li>Bạn có thể reset trạng thái "hết quota" để thử lại một key</li>
                        </ul>
                    }
                    type="info"
                    showIcon
                />
            </Space>
        </Modal>
    );
};
