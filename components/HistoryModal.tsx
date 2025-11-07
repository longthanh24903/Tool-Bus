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
} from "antd";
import {
  HistoryOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const { Search } = Input;

interface TopicHistoryItem {
  key: string;
  topic: string;
  index: number;
  createdAt?: number;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  previousTopics: string[];
  onSelectTopic: (topic: string) => void;
  onClearHistory: () => void;
  onDeleteTopic: (topic: string) => void;
  isLoading?: boolean;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  previousTopics,
  onSelectTopic,
  onClearHistory,
  onDeleteTopic,
  isLoading = false,
}) => {
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Tạo data source từ previousTopics
  const dataSource: TopicHistoryItem[] = useMemo(() => {
    return previousTopics.map((topic, index) => ({
      key: `${topic}-${index}`,
      topic,
      index: previousTopics.length - index, // Đảo ngược để mới nhất ở trên
      createdAt: Date.now() - (previousTopics.length - index) * 86400000, // Giả lập ngày tạo
    }));
  }, [previousTopics]);

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
  const columns: ColumnsType<TopicHistoryItem> = [
    {
      title: "STT",
      dataIndex: "index",
      key: "index",
      width: 80,
      align: "center",
      sorter: (a, b) => b.index - a.index,
      defaultSortOrder: "descend",
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
          }}
        >
          {text}
        </span>
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
      sorter: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
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
            icon={<CheckOutlined />}
            onClick={() => {
              onSelectTopic(record.topic);
              onClose();
            }}
          >
            Chọn
          </Button>
          <Popconfirm
            title="Xóa chủ đề này?"
            onConfirm={() => {
              onDeleteTopic(record.topic);
            }}
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

  // Xóa các chủ đề đã chọn
  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một chủ đề để xóa");
      return;
    }

    const count = selectedRowKeys.length;
    selectedRowKeys.forEach((key) => {
      const item = dataSource.find((d) => d.key === key);
      if (item) {
        onDeleteTopic(item.topic);
      }
    });
    setSelectedRowKeys([]);
    // Notification sẽ được hiển thị từ App.tsx khi deleteTopic được gọi
  };

  // Reset khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setSearchText("");
      setSelectedRowKeys([]);
    }
  }, [isOpen]);

  return (
    <Modal
      title={
        <Space>
          <HistoryOutlined />
          <span>Lịch sử Chủ đề</span>
          {previousTopics.length > 0 && (
            <Tag color="blue">{previousTopics.length} chủ đề</Tag>
          )}
        </Space>
      }
      open={isOpen}
      onCancel={onClose}
      centered
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
        previousTopics.length > 0 && (
          <Popconfirm
            key="clear"
            title="Xóa toàn bộ lịch sử?"
            onConfirm={() => {
              onClearHistory();
            }}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button danger icon={<ReloadOutlined />}>
              Xóa tất cả
            </Button>
          </Popconfirm>
        ),
        selectedRowKeys.length > 0 && (
          <Popconfirm
            key="deleteSelected"
            title={`Xóa ${selectedRowKeys.length} chủ đề đã chọn?`}
            onConfirm={handleDeleteSelected}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button danger icon={<DeleteOutlined />}>
              Xóa đã chọn ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        ),
      ].filter(Boolean)}
      styles={{
        body: { maxHeight: "70vh", overflowY: "auto", minHeight: "500px" },
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* Search bar */}
        <Search
          placeholder="Tìm kiếm chủ đề..."
          allowClear
          enterButton={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: "100%" }}
        />

        {/* Table */}
        {filteredData.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowSelection={rowSelection}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} chủ đề`,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            size="small"
            loading={isLoading}
            bordered={false}
            className="border-none"
          />
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#9ca3af",
            }}
          >
            {searchText ? (
              <>
                <p>Không tìm thấy chủ đề nào phù hợp với "{searchText}"</p>
                <Button onClick={() => setSearchText("")}>Xóa bộ lọc</Button>
              </>
            ) : (
              <p>Chưa có lịch sử chủ đề nào</p>
            )}
          </div>
        )}
      </Space>
    </Modal>
  );
};
