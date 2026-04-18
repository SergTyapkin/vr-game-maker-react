// app/editor/code/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './page.module.css';

interface ScriptFile {
  path: string;
  name: string;
  content: string;
  size: number;
  modifiedAt: string;
}

interface ScriptDirectory {
  path: string;
  name: string;
  children: (ScriptFile | ScriptDirectory)[];
}

export default function CodeEditorPage() {
  const [fileTree, setFileTree] = useState<(ScriptFile | ScriptDirectory)[]>([]);
  const [selectedFile, setSelectedFile] = useState<ScriptFile | null>(null);
  const [code, setCode] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/behaviors', '/utils']));
  const [isModified, setIsModified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotReloadStatus, setHotReloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Загрузка дерева файлов
  const loadFileTree = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scripts');
      const data = await response.json();

      if (response.ok) {
        setFileTree(data.tree);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load file tree');
    } finally {
      setLoading(false);
    }
  }, []);

  // Подключение WebSocket
  useEffect(() => {
    loadFileTree();

    // Подключаем WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'file-changed') {
          // Файл изменен извне
          console.log('[WebSocket] File changed:', data.file);

          if (selectedFile && selectedFile.path === '/' + data.file) {
            // Обновляем содержимое если это текущий файл
            setCode(data.content);
            setIsModified(false);
          }

          // Обновляем дерево файлов
          loadFileTree();
        } else if (data.type === 'hot-reload') {
          setHotReloadStatus('success');
          setTimeout(() => setHotReloadStatus('idle'), 2000);
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [loadFileTree]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const selectFile = async (file: ScriptFile) => {
    try {
      const response = await fetch(`/api/scripts?path=${encodeURIComponent(file.path)}`);
      const data = await response.json();

      if (response.ok) {
        setSelectedFile(data.file);
        setCode(data.file.content);
        setIsModified(false);
      }
    } catch (err) {
      setError('Failed to load file');
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
    setIsModified(true);
  };

  const handleSave = async () => {
    if (!selectedFile) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedFile.path,
          content: code,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSelectedFile(data.file);
        setIsModified(false);

        // Обновляем дерево файлов
        loadFileTree();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleHotReload = () => {
    if (!selectedFile || !wsRef.current) return;

    setHotReloadStatus('loading');

    // Отправляем через WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'hot-reload',
      file: selectedFile.path,
      content: code,
    }));

    // Сохраняем файл перед hot reload
    handleSave();

    setTimeout(() => {
      if (hotReloadStatus === 'loading') {
        setHotReloadStatus('success');
        setTimeout(() => setHotReloadStatus('idle'), 2000);
      }
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'r') {
        e.preventDefault();
        handleHotReload();
      }
    }
  };

  const renderFileTree = (nodes: (ScriptFile | ScriptDirectory)[], level: number = 0) => {
    return nodes.map((node) => (
      <div key={node.path} className={styles.treeItem}>
        <div
          className={`${styles.treeItemContent} ${
            selectedFile?.path === node.path ? styles.selected : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => {
            if ('children' in node) {
              toggleFolder(node.path);
            } else {
              selectFile(node);
            }
          }}
        >
          <span className={styles.treeIcon}>
            {'children' in node ? (
              expandedFolders.has(node.path) ? '📂' : '📁'
            ) : (
              '📄'
            )}
          </span>
          <span className={styles.treeName}>{node.name}</span>
        </div>
        {'children' in node && expandedFolders.has(node.path) && (
          <div className={styles.treeChildren}>
            {renderFileTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Файлы проекта</h3>
          <div className={styles.sidebarActions}>
            <button className={styles.iconButton} title="Создать файл">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 4v16m8-8H4" strokeWidth="2" />
              </svg>
            </button>
            <button className={styles.iconButton} title="Создать папку">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeWidth="2" />
                <path d="M12 11v6M9 14h6" strokeWidth="2" />
              </svg>
            </button>
            <button className={styles.iconButton} title="Обновить" onClick={loadFileTree}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M23 4v6h-6M1 20v-6h6" strokeWidth="2" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>
        <div className={styles.fileTree}>
          {loading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : (
            renderFileTree(fileTree)
          )}
        </div>
      </div>

      <div className={styles.editor}>
        {error && (
          <div className={styles.error}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" strokeWidth="2" />
            </svg>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {selectedFile ? (
          <>
            <div className={styles.editorHeader}>
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{selectedFile.name}</span>
                {isModified && <span className={styles.modifiedBadge}>●</span>}
              </div>
              <div className={styles.editorActions}>
                <button
                  className={styles.actionButton}
                  onClick={handleSave}
                  disabled={!isModified || saving}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" strokeWidth="2" />
                    <path d="M17 21v-4H7v4M12 7v6m-3-3h6" strokeWidth="2" />
                  </svg>
                  {saving ? 'Сохранение...' : 'Сохранить (Ctrl+S)'}
                </button>
                <button
                  className={`${styles.actionButton} ${styles.hotReload} ${
                    styles[hotReloadStatus]
                  }`}
                  onClick={handleHotReload}
                  disabled={hotReloadStatus === 'loading'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M23 4v6h-6M1 20v-6h6" strokeWidth="2" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeWidth="2" />
                  </svg>
                  {hotReloadStatus === 'loading' ? 'Загрузка...' :
                    hotReloadStatus === 'success' ? 'Готово!' :
                      'Hot Reload (Ctrl+R)'}
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className={styles.codeEditor}
              value={code}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              placeholder="// Напишите ваш код здесь..."
            />
          </>
        ) : (
          <div className={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeWidth="2" />
              <path d="M14 2v6h6M12 18v-4M9 14h6" strokeWidth="2" />
            </svg>
            <h3>Выберите файл</h3>
            <p>Выберите файл из дерева слева, чтобы начать редактирование</p>
          </div>
        )}
      </div>
    </div>
  );
}
