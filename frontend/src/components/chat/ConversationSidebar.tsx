/**
 * 会话侧边栏组件
 * 用于显示和管理聊天会话和分组
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import apiService from '@/services/apiService';

export interface ConversationGroup {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  groupId?: string;
  currentModel: 't5' | 'deepseek';
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  groups: ConversationGroup[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onCreateGroup: (name: string) => void;
  onMoveToGroup: (conversationId: string, groupId: string) => void;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  groups,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onCreateGroup,
  onMoveToGroup,
}) => {
  // 新建分组相关状态
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  // 重命名会话相关状态
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  
  // 分组折叠状态
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    conversationId: string;
  } | null>(null);
  
  // 切换分组折叠状态
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // 提交新建分组
  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim());
      setNewGroupName('');
      setShowGroupInput(false);
    }
  };
  
  // 提交会话重命名
  const handleRenameConversation = () => {
    if (renamingConversationId && newConversationTitle.trim()) {
      onRenameConversation(renamingConversationId, newConversationTitle.trim());
      setRenamingConversationId(null);
      setNewConversationTitle('');
    }
  };
  
  // 关闭上下文菜单
  const closeContextMenu = () => {
    setContextMenu(null);
  };
  
  // 处理会话右键菜单
  const handleContextMenu = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      conversationId
    });
  };
  
  // 按时间分组会话
  const getConversationsByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const todayConversations = conversations.filter(c => 
      !c.groupId && new Date(c.updatedAt) >= today
    );
    
    const yesterdayConversations = conversations.filter(c => 
      !c.groupId && 
      new Date(c.updatedAt) >= yesterday && 
      new Date(c.updatedAt) < today
    );
    
    const lastWeekConversations = conversations.filter(c => 
      !c.groupId && 
      new Date(c.updatedAt) >= lastWeek && 
      new Date(c.updatedAt) < yesterday
    );
    
    const olderConversations = conversations.filter(c => 
      !c.groupId && new Date(c.updatedAt) < lastWeek
    );
    
    return {
      today: todayConversations,
      yesterday: yesterdayConversations,
      lastWeek: lastWeekConversations,
      older: olderConversations
    };
  };
  
  // 根据分组返回会话
  const getConversationsByGroup = (groupId: string) => {
    return conversations.filter(c => c.groupId === groupId);
  };
  
  const dateGroupedConversations = getConversationsByDate();
  
  return (
    <div className="h-full flex flex-col bg-gray-900 w-64 text-white p-2 overflow-y-auto">
      {/* 新建会话按钮 */}
      <button
        onClick={onNewConversation}
        className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
      >
        新建会话
      </button>
      
      {/* 新建分组按钮和输入框 !showGroupInput
      {!showGroupInput ? (
        <button
          onClick={() => setShowGroupInput(true)}
          className="w-full mb-4 bg-gray-700 hover:bg-gray-600 text-white py-1 px-4 rounded-md transition-colors text-sm"
        >
          新建分组
        </button>
      ) : (
        <div className="flex mb-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="分组名称"
            className="flex-1 bg-gray-800 text-white px-2 py-1 rounded-l-md outline-none"
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
          />
          <button
            onClick={handleCreateGroup}
            className="bg-green-600 hover:bg-green-700 text-white px-2 rounded-r-md"
          >
            创建
          </button>
        </div>
      )} */}
      
      {/* 分组列表 */}
      {groups.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase">分组</h3>
          {groups.map(group => (
            <div key={group.id} className="mb-2">
              <div 
                className="flex items-center bg-gray-800 p-2 rounded-md cursor-pointer"
                onClick={() => toggleGroupCollapse(group.id)}
              >
                <span className="mr-1">
                  {collapsedGroups[group.id] ? '▶' : '▼'}
                </span>
                <span className="flex-1 truncate">{group.name}</span>
                <span className="text-xs text-gray-500">
                  {getConversationsByGroup(group.id).length}
                </span>
              </div>
              
              {!collapsedGroups[group.id] && (
                <div className="ml-2 mt-1">
                  {getConversationsByGroup(group.id).map(conversation => (
                    <div 
                      key={conversation.id}
                      className={`p-2 rounded-md cursor-pointer mb-1 truncate ${selectedConversationId === conversation.id ? 'bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                      onClick={() => onSelectConversation(conversation.id)}
                      onContextMenu={(e) => handleContextMenu(e, conversation.id)}
                    >
                      {renamingConversationId === conversation.id ? (
                        <div className="flex">
                          <input
                            type="text"
                            value={newConversationTitle}
                            onChange={(e) => setNewConversationTitle(e.target.value)}
                            className="flex-1 bg-gray-800 text-white px-1 rounded outline-none text-sm"
                            autoFocus
                            onKeyPress={(e) => e.key === 'Enter' && handleRenameConversation()}
                            onBlur={handleRenameConversation}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="flex-1 truncate">{conversation.title}</span>
                          <span className="ml-1 text-xs px-1 rounded bg-purple-800">
                            {conversation.currentModel === 't5' ? 'T5' : 'DS'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 按时间分组的会话 */}
      {dateGroupedConversations.today.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-400 mb-1 uppercase">今天</h3>
          {dateGroupedConversations.today.map(conversation => (
            <ConversationItem 
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.id}
              isRenaming={renamingConversationId === conversation.id}
              newTitle={newConversationTitle}
              onSelect={() => onSelectConversation(conversation.id)}
              onContextMenu={(e) => handleContextMenu(e, conversation.id)}
              onTitleChange={(e) => setNewConversationTitle(e.target.value)}
              onRename={handleRenameConversation}
            />
          ))}
        </div>
      )}
      
      {dateGroupedConversations.yesterday.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-400 mb-1 uppercase">昨天</h3>
          {dateGroupedConversations.yesterday.map(conversation => (
            <ConversationItem 
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.id}
              isRenaming={renamingConversationId === conversation.id}
              newTitle={newConversationTitle}
              onSelect={() => onSelectConversation(conversation.id)}
              onContextMenu={(e) => handleContextMenu(e, conversation.id)}
              onTitleChange={(e) => setNewConversationTitle(e.target.value)}
              onRename={handleRenameConversation}
            />
          ))}
        </div>
      )}
      
      {dateGroupedConversations.lastWeek.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-400 mb-1 uppercase">本周</h3>
          {dateGroupedConversations.lastWeek.map(conversation => (
            <ConversationItem 
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.id}
              isRenaming={renamingConversationId === conversation.id}
              newTitle={newConversationTitle}
              onSelect={() => onSelectConversation(conversation.id)}
              onContextMenu={(e) => handleContextMenu(e, conversation.id)}
              onTitleChange={(e) => setNewConversationTitle(e.target.value)}
              onRename={handleRenameConversation}
            />
          ))}
        </div>
      )}
      
      {dateGroupedConversations.older.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-400 mb-1 uppercase">更早</h3>
          {dateGroupedConversations.older.map(conversation => (
            <ConversationItem 
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.id}
              isRenaming={renamingConversationId === conversation.id}
              newTitle={newConversationTitle}
              onSelect={() => onSelectConversation(conversation.id)}
              onContextMenu={(e) => handleContextMenu(e, conversation.id)}
              onTitleChange={(e) => setNewConversationTitle(e.target.value)}
              onRename={handleRenameConversation}
            />
          ))}
        </div>
      )}
      
      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 shadow-lg rounded-md overflow-hidden z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-white"
            onClick={() => {
              const conversation = conversations.find(c => c.id === contextMenu.conversationId);
              if (conversation) {
                setRenamingConversationId(conversation.id);
                setNewConversationTitle(conversation.title);
                closeContextMenu();
              }
            }}
          >
            重命名
          </button>
          <div className="border-t border-gray-700" />
          
          {/* 移动到分组菜单 */}
          {groups.length > 0 && (
            <>
              <div className="px-4 py-1 text-xs text-gray-500">移到分组</div>
              {groups.map(group => (
                <button
                  key={group.id}
                  className="block w-full text-left px-4 py-1 hover:bg-gray-700 text-white text-sm"
                  onClick={() => {
                    onMoveToGroup(contextMenu.conversationId, group.id);
                    closeContextMenu();
                  }}
                >
                  {group.name}
                </button>
              ))}
              <div className="border-t border-gray-700" />
            </>
          )}
          
          <button
            className="block w-full text-left px-4 py-2 hover:bg-red-700 text-red-400 hover:text-white"
            onClick={() => {
              onDeleteConversation(contextMenu.conversationId);
              closeContextMenu();
            }}
          >
            删除
          </button>
        </div>
      )}
      
      {/* 点击其他位置关闭右键菜单 */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeContextMenu}
        />
      )}
    </div>
  );
};

// 会话项子组件
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isRenaming: boolean;
  newTitle: string;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRename: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  isRenaming,
  newTitle,
  onSelect,
  onContextMenu,
  onTitleChange,
  onRename
}) => {
  return (
    <div 
      className={`p-2 rounded-md cursor-pointer mb-1 ${isSelected ? 'bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {isRenaming ? (
        <div className="flex">
          <input
            type="text"
            value={newTitle}
            onChange={onTitleChange}
            className="flex-1 bg-gray-800 text-white px-1 rounded outline-none text-sm"
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && onRename()}
            onBlur={onRename}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <div className="flex items-center">
          <span className="flex-1 truncate">{conversation.title}</span>
          {/* <span className="ml-1 text-xs px-1 rounded bg-purple-800">
            {conversation.currentModel === 't5' ? 'T5' : 'DS'}
          </span> */}
        </div>
      )}
    </div>
  );
};

export default ConversationSidebar;
