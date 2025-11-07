import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import viVN from 'antd/locale/vi_VN';
import App from './App';
import 'antd/dist/reset.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ConfigProvider 
      locale={viVN}
      theme={{
        algorithm: theme.defaultAlgorithm, // Light mode
        token: {
          // Primary colors - #7951d4
          colorPrimary: '#7951d4', // Main purple
          colorPrimaryHover: '#8b5cf6', // Lighter purple on hover
          colorPrimaryActive: '#6d3fc7', // Darker purple on active
          
          // Background colors - light theme
          colorBgBase: '#F9F9FB', // Very light gray background
          colorBgContainer: '#FFFFFF', // White containers
          colorBgElevated: '#FFFFFF', // White for elevated elements
          colorBgSpotlight: '#F5F5F7', // Light gray for highlights
          
          // Text colors - dark for light mode (improved contrast)
          colorText: '#1E1E1E', // Darker for better contrast
          colorTextSecondary: '#4a4a4a', // Dark gray for secondary text
          colorTextTertiary: '#6b6b6b', // Medium gray
          colorTextQuaternary: '#7E7E85', // Better contrast for placeholders
          
          // Border colors - light borders
          colorBorder: '#E2E0EB', // Slightly darker for better visibility
          colorBorderSecondary: '#E9E6F8', // Purple tint border
          
          // Success, Warning, Error colors
          colorSuccess: '#10b981', // emerald-500
          colorWarning: '#f59e0b', // amber-500
          colorError: '#ef4444', // red-500
          colorInfo: '#3b82f6', // blue-500
          
          // Component specific
          borderRadius: 10,
          borderRadiusLG: 12,
          borderRadiusSM: 8,
          
          // Shadows - light and subtle
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
          boxShadowSecondary: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06)',
        },
        components: {
          Button: {
            primaryShadow: '0 4px 12px rgba(121, 81, 212, 0.3)',
            borderRadius: 10,
          },
          Input: {
            activeBorderColor: '#7951d4',
            hoverBorderColor: '#9B7BF5',
            borderRadius: 10,
            paddingBlock: 8,
            paddingInline: 12,
          },
          Select: {
            activeBorderColor: '#7951d4',
            hoverBorderColor: '#9B7BF5',
            borderRadius: 10,
          },
          Switch: {
            colorPrimary: '#7951d4',
            colorPrimaryHover: '#9B7BF5',
          },
          Card: {
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
