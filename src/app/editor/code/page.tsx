// app/editor/code/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

// Динамический импорт Monaco Editor (только на клиенте)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Загрузка редактора...</div>,
});

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

// Определение языка для Monaco по расширению файла
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'py':
      return 'python';
    case 'glsl':
      return 'glsl';
    default:
      return 'javascript';
  }
}

// Настройки темы Monaco
const editorOptions = {
  fontSize: 14,
  lineHeight: 21,
  fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const,
  formatOnPaste: true,
  formatOnType: true,
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  bracketPairColorization: { enabled: true },
  renderWhitespace: 'selection' as const,
  guides: {
    bracketPairs: true,
    indentation: true,
  },
};

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
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemParent, setNewItemParent] = useState<string>('/');

  const wsRef = useRef<WebSocket | null>(null);
  const editorRef = useRef<any>(null);

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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:8000/api/ws/scenes`);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'file-changed') {
          console.log('[WebSocket] File changed:', data.file);

          if (selectedFile && selectedFile.path === '/' + data.file) {
            // Обновляем содержимое если это текущий файл
            setCode(data.content);
            setIsModified(false);
          }

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
        setError(null);
      }
    } catch (err) {
      setError('Failed to load file');
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setIsModified(true);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Добавляем команды
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => handleSave()
    );

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR,
      () => handleHotReload()
    );
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
        await loadFileTree();
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

    wsRef.current.send(JSON.stringify({
      type: 'hot-reload',
      file: selectedFile.path,
      content: code,
    }));

    handleSave();

    setTimeout(() => {
      if (hotReloadStatus === 'loading') {
        setHotReloadStatus('success');
        setTimeout(() => setHotReloadStatus('idle'), 2000);
      }
    }, 1000);
  };

  // app/editor/code/page.tsx
  const handleCreateFile = async () => {
    if (!newItemName.trim()) return;

    const path = newItemParent === '/' ? `/${newItemName}` : `${newItemParent}/${newItemName}`;

    try {
      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          content: '// New file',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Обновляем дерево файлов
        await loadFileTree();

        // Закрываем модальное окно
        setIsCreatingFile(false);
        setNewItemName('');

        // Опционально: автоматически открываем созданный файл
        if (data.file) {
          // Добавляем родительскую папку в expanded
          if (newItemParent !== '/') {
            setExpandedFolders(prev => {
              const next = new Set(prev);
              next.add(newItemParent);
              return next;
            });
          }

          // Выбираем созданный файл
          setTimeout(() => selectFile(data.file), 100);
        }
      } else {
        setError(data.error || 'Failed to create file');
      }
    } catch (err) {
      setError('Failed to create file');
    }
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim()) return;

    const path = newItemParent === '/' ? `/${newItemName}` : `${newItemParent}/${newItemName}`;

    try {
      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${path}/.gitkeep`,
          content: '',
        }),
      });

      if (response.ok) {
        // Обновляем дерево файлов
        await loadFileTree();

        // Добавляем новую папку в expanded
        setExpandedFolders(prev => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });

        setIsCreatingFolder(false);
        setNewItemName('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create folder');
      }
    } catch (err) {
      setError('Failed to create folder');
    }
  };

  const handleDeleteFile = async (file: ScriptFile) => {
    if (!confirm(`Delete ${file.name}?`)) return;

    try {
      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          action: 'delete',
        }),
      });

      if (response.ok) {
        if (selectedFile?.path === file.path) {
          setSelectedFile(null);
          setCode('');
        }
        await loadFileTree();
      }
    } catch (err) {
      setError('Failed to delete file');
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
        >
          <span
            className={styles.treeIcon}
            onClick={() => {
              if ('children' in node) {
                toggleFolder(node.path);
              }
            }}
          >
            {'children' in node ? (
              expandedFolders.has(node.path) ? '📂' : '📁'
            ) : (
              '📄'
            )}
          </span>
          <span
            className={styles.treeName}
            onClick={() => {
              if ('children' in node) {
                toggleFolder(node.path);
              } else {
                selectFile(node);
              }
            }}
          >
            {node.name}
          </span>
          {'children' in node && (
            <div className={styles.treeActions}>
              <button
                className={styles.treeAction}
                onClick={() => {
                  setNewItemParent(node.path);
                  setIsCreatingFile(true);
                }}
                title="New file"
              >
                📄+
              </button>
              <button
                className={styles.treeAction}
                onClick={() => {
                  setNewItemParent(node.path);
                  setIsCreatingFolder(true);
                }}
                title="New folder"
              >
                📁+
              </button>
            </div>
          )}
          {!('children' in node) && (
            <div className={styles.treeActions}>
              <button
                className={styles.treeAction}
                onClick={() => handleDeleteFile(node)}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
        {'children' in node && expandedFolders.has(node.path) && (
          <div className={styles.treeChildren}>
            {renderFileTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  // Модальное окно для создания файла/папки
  const renderCreateModal = () => {
    if (!isCreatingFile && !isCreatingFolder) return null;

    return (
      <div className={styles.modalOverlay} onClick={() => {
        setIsCreatingFile(false);
        setIsCreatingFolder(false);
        setNewItemName('');
      }}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h3>{isCreatingFile ? 'Создать файл' : 'Создать папку'}</h3>
          <input
            type="text"
            placeholder={isCreatingFile ? 'example.js' : 'new-folder'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                isCreatingFile ? handleCreateFile() : handleCreateFolder();
              } else if (e.key === 'Escape') {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
                setNewItemName('');
              }
            }}
          />
          <div className={styles.modalActions}>
            <button onClick={() => {
              setIsCreatingFile(false);
              setIsCreatingFolder(false);
              setNewItemName('');
            }}>Отмена</button>
            <button onClick={isCreatingFile ? handleCreateFile : handleCreateFolder}>
              Создать
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Определяем язык для текущего файла
  const currentLanguage = selectedFile
    ? getLanguageFromFilename(selectedFile.name)
    : 'javascript';

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Файлы проекта</h3>
          <div className={styles.sidebarActions}>
            <button
              className={styles.iconButton}
              title="Создать файл"
              onClick={() => {
                setNewItemParent('/');
                setIsCreatingFile(true);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 4v16m8-8H4" strokeWidth="2" />
              </svg>
            </button>
            <button
              className={styles.iconButton}
              title="Создать папку"
              onClick={() => {
                setNewItemParent('/');
                setIsCreatingFolder(true);
              }}
            >
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
                <span className={styles.fileLanguage}>{currentLanguage}</span>
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
                  {saving ? 'Сохранение...' : 'Сохранить'}
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
                      'Hot Reload'}
                </button>
              </div>
            </div>
            <div className={styles.monacoContainer}>
              <MonacoEditor
                height="100%"
                language={currentLanguage}
                value={code}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={editorOptions}
              />
            </div>
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

      {renderCreateModal()}
    </div>
  );
}
