import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Switch,
  InputNumber,
  Input,
  Button,
  Space,
  Divider,
  Alert,
  message,
  notification,
} from 'antd';
import {
  SettingOutlined,
  FolderOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { autoSaveService } from '../services/autoSaveService';
import type { AutoWriteConfig, AutoSaveConfig } from '../types';

interface AutoWriteSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  autoWriteConfig: AutoWriteConfig;
  onAutoWriteConfigChange: (config: AutoWriteConfig) => void;
}

export const AutoWriteSettings: React.FC<AutoWriteSettingsProps> = ({
  isOpen,
  onClose,
  autoWriteConfig,
  onAutoWriteConfigChange,
}) => {
  const [form] = Form.useForm();
  const [autoSaveConfig, setAutoSaveConfig] = useState<AutoSaveConfig>(
    autoSaveService.getConfig()
  );
  const [isFileSystemSupported, setIsFileSystemSupported] = useState(false);
  const [isRequestingDirectory, setIsRequestingDirectory] = useState(false);

  useEffect(() => {
    setIsFileSystemSupported(autoSaveService.isFileSystemAPISupported());
    const config = autoSaveService.getConfig();
    setAutoSaveConfig(config);
    
    // Set form values
    form.setFieldsValue({
      autoWriteEnabled: autoWriteConfig.enabled,
      autoSuggestTopic: autoWriteConfig.autoSuggestTopic,
      delayBetweenParts: autoWriteConfig.delayBetweenParts,
      autoLoop: autoWriteConfig.autoLoop || false,
      maxStories: autoWriteConfig.maxStories !== undefined ? autoWriteConfig.maxStories : 0,
      autoSaveEnabled: config.enabled,
      useFileSystemAPI: config.useFileSystemAPI,
      folderNameTemplate: config.folderNameTemplate,
      fileNameTemplate: config.fileNameTemplate,
      autoCreateFolder: config.autoCreateFolder,
    });
  }, [isOpen, autoWriteConfig, form]);

  const handleRequestDirectory = async () => {
    setIsRequestingDirectory(true);
    try {
      const handle = await autoSaveService.requestDirectoryAccess();
      if (handle) {
        const updatedConfig = autoSaveService.getConfig();
        setAutoSaveConfig(updatedConfig);
        form.setFieldsValue({
          useFileSystemAPI: true,
          directoryPath: handle.name,
        });
        notification.success({
          message: 'Đã chọn thư mục',
          description: `Thư mục "${handle.name}" đã được chọn. Files sẽ được lưu vào đây.`,
          icon: <CheckCircleOutlined style={{ color: '#7951d4' }} />,
          placement: 'topRight',
          duration: 3,
        });
      }
    } catch (error: any) {
      message.error('Không thể chọn thư mục: ' + error.message);
    } finally {
      setIsRequestingDirectory(false);
    }
  };

  const handleSave = () => {
    const values = form.getFieldsValue();
    
    // Update Auto Write Config
    const newAutoWriteConfig: AutoWriteConfig = {
      enabled: values.autoWriteEnabled || false,
      autoSuggestTopic: values.autoSuggestTopic || false,
      delayBetweenParts: values.delayBetweenParts || 2000,
      autoLoop: values.autoLoop || false,
      maxStories: values.maxStories !== undefined && values.maxStories !== null && values.maxStories !== '' 
        ? Number(values.maxStories) 
        : 0, // 0 = vô hạn
    };
    onAutoWriteConfigChange(newAutoWriteConfig);

    // Update Auto Save Config
    const newAutoSaveConfig: AutoSaveConfig = {
      enabled: values.autoSaveEnabled || false,
      useFileSystemAPI: values.useFileSystemAPI && isFileSystemSupported,
      folderNameTemplate: values.folderNameTemplate || 'auto-{date}',
      fileNameTemplate: values.fileNameTemplate || '{topic}-{timestamp}.txt',
      autoCreateFolder: values.autoCreateFolder || true,
    };
    autoSaveService.updateConfig(newAutoSaveConfig);
    setAutoSaveConfig(newAutoSaveConfig);

    notification.success({
      message: 'Đã lưu cấu hình',
      description: 'Các cài đặt Auto Write và Auto Save đã được lưu thành công.',
      icon: <CheckCircleOutlined style={{ color: '#7951d4' }} />,
      placement: 'topRight',
      duration: 2,
    });

    onClose();
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined style={{ color: '#7951d4' }} />
          <span>Cài đặt Auto Write & Auto Save</span>
        </span>
      }
      open={isOpen}
      onCancel={onClose}
      onOk={handleSave}
      okText="Lưu"
      cancelText="Hủy"
      width={700}
      style={{ top: 20 }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
        {/* Auto Write Section */}
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#7951d4',
              marginBottom: 16,
            }}
          >
            🤖 Auto Write Mode
          </h3>
          <Form.Item
            name="autoWriteEnabled"
            valuePropName="checked"
            label="Bật Auto Write Mode"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.autoWriteEnabled !== currentValues.autoWriteEnabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('autoWriteEnabled') ? (
                <>
                  <Form.Item
                    name="autoSuggestTopic"
                    valuePropName="checked"
                    label="Tự động gợi ý topic (nếu topic trống)"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    name="delayBetweenParts"
                    label="Delay giữa các phần (milliseconds)"
                    tooltip="Thời gian chờ giữa mỗi phần để tránh rate limit API"
                  >
                    <InputNumber
                      min={0}
                      max={10000}
                      step={500}
                      style={{ width: '100%' }}
                      addonAfter="ms"
                    />
                  </Form.Item>
                  <Form.Item
                    name="autoLoop"
                    valuePropName="checked"
                    label="Auto Loop - Tự động lặp lại"
                    tooltip="Sau khi hoàn thành một story, tự động gợi ý topic mới và bắt đầu story tiếp theo. Sẽ tự động tải về file sau mỗi story."
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.autoLoop !== currentValues.autoLoop
                    }
                  >
                    {({ getFieldValue }) =>
                      getFieldValue('autoLoop') ? (
                        <Form.Item
                          name="maxStories"
                          label="Số kịch bản tối đa"
                          tooltip="Nhập số kịch bản tối đa sẽ được tạo. Để 0 hoặc trống = vô hạn. Ví dụ: 10 = sẽ tạo 10 kịch bản rồi dừng."
                          rules={[
                            {
                              validator: (_, value) => {
                                if (value === undefined || value === null || value === '') {
                                  return Promise.resolve(); // Cho phép để trống (vô hạn)
                                }
                                const num = Number(value);
                                if (isNaN(num) || num < 0) {
                                  return Promise.reject('Vui lòng nhập số hợp lệ (>= 0)');
                                }
                                return Promise.resolve();
                              },
                            },
                          ]}
                        >
                          <InputNumber
                            min={0}
                            max={1000}
                            step={1}
                            style={{ width: '100%' }}
                            placeholder="0 = vô hạn"
                            addonAfter="kịch bản"
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                  <Alert
                    message="Chế độ Auto Loop"
                    description="Khi bật, hệ thống sẽ tự động: (1) Gợi ý topic mới, (2) Viết tất cả parts, (3) Tự động tải về file, (4) Lặp lại với story mới. Nhập số kịch bản tối đa hoặc để 0 để chạy vô hạn. Nhấn nút 'Dừng Auto Loop' để dừng bất cứ lúc nào."
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : null
            }
          </Form.Item>
        </div>

        <Divider />

        {/* Auto Save Section */}
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#7951d4',
              marginBottom: 16,
            }}
          >
            💾 Auto Save Configuration
          </h3>
          
          {!isFileSystemSupported && (
            <Alert
              message="File System API không được hỗ trợ"
              description="Trình duyệt của bạn không hỗ trợ File System Access API. Sẽ sử dụng chế độ auto download thay thế."
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="autoSaveEnabled"
            valuePropName="checked"
            label="Bật Auto Save"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.autoSaveEnabled !== currentValues.autoSaveEnabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('autoSaveEnabled') ? (
                <>
                  {isFileSystemSupported && (
                    <>
                      <Form.Item
                        name="useFileSystemAPI"
                        valuePropName="checked"
                        label="Sử dụng File System API"
                        tooltip="Cho phép chọn thư mục để lưu file tự động (chỉ hỗ trợ Chrome/Edge)"
                      >
                        <Switch disabled={!isFileSystemSupported} />
                      </Form.Item>

                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues.useFileSystemAPI !==
                          currentValues.useFileSystemAPI
                        }
                      >
                        {({ getFieldValue }) =>
                          getFieldValue('useFileSystemAPI') ? (
                            <Form.Item label="Thư mục lưu file">
                              <Space>
                                <Input
                                  value={autoSaveConfig.directoryPath || 'Chưa chọn'}
                                  disabled
                                  style={{ flex: 1 }}
                                />
                                <Button
                                  icon={<FolderOutlined />}
                                  onClick={handleRequestDirectory}
                                  loading={isRequestingDirectory}
                                >
                                  Chọn thư mục
                                </Button>
                              </Space>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#8c8c8c',
                                  marginTop: 4,
                                }}
                              >
                                Chọn thư mục để lưu file tự động. Cần chọn lại mỗi lần mở app.
                              </div>
                            </Form.Item>
                          ) : null
                        }
                      </Form.Item>
                    </>
                  )}

                  <Form.Item
                    name="autoCreateFolder"
                    valuePropName="checked"
                    label="Tự động tạo thư mục con"
                    tooltip="Tạo thư mục con theo template để tổ chức files"
                  >
                    <Switch />
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.autoCreateFolder !==
                      currentValues.autoCreateFolder
                    }
                  >
                    {({ getFieldValue }) =>
                      getFieldValue('autoCreateFolder') ? (
                        <Form.Item
                          name="folderNameTemplate"
                          label="Template tên thư mục"
                          tooltip="Sử dụng {date}, {timestamp}, {time} để thay thế"
                        >
                          <Input placeholder="auto-{date}" />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>

                  <Form.Item
                    name="fileNameTemplate"
                    label="Template tên file"
                    tooltip="Sử dụng {topic}, {timestamp}, {date}, {time} để thay thế"
                  >
                    <Input placeholder="{topic}-{timestamp}.txt" />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

