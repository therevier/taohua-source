import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import type { PublicTask } from '../../shared/types';

export function EditorPanel({
  task,
  value,
  onChange,
  onReset,
}: {
  task: PublicTask;
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  const extensions = task.language === 'python' ? [python()] : [javascript()];
  return (
    <div className="editor">
      <div className="editor-bar">
        <span>{task.language === 'python' ? 'Python' : 'JavaScript'}</span>
        <button className="link-btn" onClick={onReset}>
          重置本步
        </button>
      </div>
      <div className="editor-cm">
        <CodeMirror
          value={value}
          height="100%"
          extensions={extensions}
          basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: false }}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
