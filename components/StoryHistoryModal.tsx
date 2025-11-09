import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Table,
  Button,
  Space,
  Popconfirm,
  Input,
  message,
  Tag,
  Badge,
} from "antd";
const { confirm } = Modal;
import {
  DownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined,
  DownloadOutlined as DownloadAllOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { storyHistoryService } from "../services/storyHistoryService";
import type { StoryHistoryItem } from "../types";

const { Search } = Input;

interface StoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoryHistoryModal: React.FC<StoryHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [history, setHistory] = useState<StoryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load history khi modal mở
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = () => {
    setLoading(true);
    try {
      const allHistory = storyHistoryService.getAll();
      setHistory(allHistory);
    } catch (error) {
      console.error("Failed to load story history:", error);
      message.error("Không thể tải lịch sử kịch bản");
    } finally {
      setLoading(false);
    }
  };

  // Tạo data source cho Table
  const dataSource = useMemo(() => {
    return history.map((item) => ({
      key: item.id,
      ...item,
    }));
  }, [history]);

  // Filter data theo search text
  const filteredData = useMemo(() => {
    if (!searchText.trim()) {
      return dataSource;
    }
    return dataSource.filter((item) =>
      item.topic.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [dataSource, searchText]);

  // Format ngày tháng
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Columns cho Table
  const columns: ColumnsType<StoryHistoryItem & { key: string }> = [
    {
      title: "STT",
      dataIndex: "storyNumber",
      key: "storyNumber",
      width: 80,
      align: "center",
      render: (storyNumber: number | undefined, record) => {
        if (storyNumber) {
          return (
            <Badge
              count={storyNumber}
              style={{ backgroundColor: "#52c41a" }}
              title={`Story #${storyNumber}`}
            />
          );
        }
        return <span style={{ color: "#9ca3af" }}>-</span>;
      },
      sorter: (a, b) => {
        const aNum = a.storyNumber || 0;
        const bNum = b.storyNumber || 0;
        return bNum - aNum;
      },
    },
    {
      title: "Chủ đề",
      dataIndex: "topic",
      key: "topic",
      ellipsis: true,
      render: (text: string) => (
        <span
          style={{
            maxWidth: "400px",
            display: "inline-block",
            fontWeight: 500,
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: "Số phần",
      dataIndex: "storyParts",
      key: "parts",
      width: 100,
      align: "center",
      render: (parts: any[]) => (
        <Tag color="blue">{parts.length} phần</Tag>
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (timestamp: number) => (
        <span style={{ color: "#9ca3af", fontSize: "12px" }}>
          {formatDate(timestamp)}
        </span>
      ),
      sorter: (a, b) => b.createdAt - a.createdAt,
      defaultSortOrder: "descend" as const,
    },
    {
      title: "Hành động",
      key: "action",
      width: 200,
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
          >
            Tải về
          </Button>
          <Popconfirm
            title="Xóa kịch bản này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Row selection config
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };

  // Tải về một kịch bản
  const handleDownload = (item: StoryHistoryItem) => {
    try {
      storyHistoryService.downloadStory(item);
      message.success(`Đã tải về: ${item.topic}`);
    } catch (error) {
      console.error("Failed to download story:", error);
      message.error("Không thể tải về kịch bản");
    }
  };

  // Tải về nhiều kịch bản
  const handleDownloadSelected = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một kịch bản để tải về");
      return;
    }

    const selectedItems = history.filter((item) =>
      selectedRowKeys.includes(item.id)
    );

    try {
      storyHistoryService.downloadStories(selectedItems);
      message.success(
        `Đang tải về ${selectedItems.length} kịch bản... (có thể mất vài giây)`
      );
      setSelectedRowKeys([]);
    } catch (error) {
      console.error("Failed to download stories:", error);
      message.error("Không thể tải về các kịch bản");
    }
  };

  // Tải về tất cả
  const handleDownloadAll = () => {
    if (filteredData.length === 0) {
      message.warning("Không có kịch bản nào để tải về");
      return;
    }

    try {
      const items = filteredData.map((item) => ({
        id: item.id,
        topic: item.topic,
        storyParts: item.storyParts,
        storyOutline: item.storyOutline,
        createdAt: item.createdAt,
        storyNumber: item.storyNumber,
      }));
      storyHistoryService.downloadStories(items);
      message.success(
        `Đang tải về ${items.length} kịch bản... (có thể mất vài giây)`
      );
    } catch (error) {
      console.error("Failed to download all stories:", error);
      message.error("Không thể tải về tất cả kịch bản");
    }
  };

  // Xóa một kịch bản
  const handleDelete = (id: string) => {
    try {
      const success = storyHistoryService.delete(id);
      if (success) {
        message.success("Đã xóa kịch bản");
        loadHistory();
        setSelectedRowKeys(selectedRowKeys.filter((key) => key !== id));
      } else {
        message.error("Không thể xóa kịch bản");
      }
    } catch (error) {
      console.error("Failed to delete story:", error);
      message.error("Không thể xóa kịch bản");
    }
  };

  // Xóa các kịch bản đã chọn
  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một kịch bản để xóa");
      return;
    }

    confirm({
      title: `Xóa ${selectedRowKeys.length} kịch bản đã chọn?`,
      content: "Hành động này không thể hoàn tác!",
      onOk: () => {
        try {
          const deletedCount = storyHistoryService.deleteMany(
            selectedRowKeys as string[]
          );
          if (deletedCount > 0) {
            message.success(`Đã xóa ${deletedCount} kịch bản`);
            loadHistory();
            setSelectedRowKeys([]);
          } else {
            message.error("Không thể xóa các kịch bản");
          }
        } catch (error) {
          console.error("Failed to delete stories:", error);
          message.error("Không thể xóa các kịch bản");
        }
      },
      okText: "Xóa",
      cancelText: "Hủy",
      okType: "danger",
    });
  };

  // Xóa tất cả
  const handleClearAll = () => {
    try {
      storyHistoryService.clearAll();
      message.success("Đã xóa tất cả kịch bản");
      loadHistory();
      setSelectedRowKeys([]);
    } catch (error) {
      console.error("Failed to clear all stories:", error);
      message.error("Không thể xóa tất cả kịch bản");
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileTextOutlined style={{ color: "#7951d4" }} />
          <span>Lịch sử Kịch bản ({history.length})</span>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <div style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Search
              placeholder="Tìm kiếm theo chủ đề..."
              allowClear
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ flex: 1 }}
              prefix={<SearchOutlined />}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={loadHistory}
              loading={loading}
            >
              Làm mới
            </Button>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadSelected}
                disabled={selectedRowKeys.length === 0}
              >
                Tải về đã chọn ({selectedRowKeys.length})
              </Button>
              <Button
                icon={<DownloadAllOutlined />}
                onClick={handleDownloadAll}
                disabled={filteredData.length === 0}
              >
                Tải về tất cả ({filteredData.length})
              </Button>
            </Space>
            <Space>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDeleteSelected}
                disabled={selectedRowKeys.length === 0}
              >
                Xóa đã chọn
              </Button>
              <Popconfirm
                title="Xóa tất cả kịch bản?"
                description="Hành động này không thể hoàn tác!"
                onConfirm={handleClearAll}
                okText="Xóa"
                cancelText="Hủy"
                okType="danger"
              >
                <Button danger icon={<DeleteOutlined />}>
                  Xóa tất cả
                </Button>
              </Popconfirm>
            </Space>
          </div>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        rowSelection={rowSelection}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Tổng: ${total} kịch bản`,
        }}
        scroll={{ y: 400 }}
      />
    </Modal>
  );
};

