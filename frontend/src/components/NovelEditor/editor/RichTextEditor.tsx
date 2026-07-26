import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ align: [] }],
  ['clean'],
];

const FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'indent',
  'align',
  'blockquote',
  'code-block',
];

/** Quill 對「沒有內容」的表示法，換算成空字串比較好處理。 */
const EMPTY = '<p><br></p>';

function normaliseHtml(html: string): string {
  return html === EMPTY ? '' : html;
}

/**
 * 直接封裝 Quill 2 的受控編輯器。
 *
 * 原本使用 react-quill@2.0.0，但它自 2021 年起未再維護，
 * 且相依的是有 XSS 公告的 quill 1.x，同時把 React 的 peer 版本鎖在 17。
 * 這個封裝約 60 行，換掉一個無法升級的相依，並讓 quill 版本由我們自己決定。
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel = '章節內容編輯器',
}: RichTextEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  // onChange 每次 render 都是新函式，用 ref 保存才不必為此重建整個編輯器。
  // 指派必須放在 effect 裡：render 期間寫 ref 會讓行為與 React 的併發渲染不一致。
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || quillRef.current) return;

    const editorEl = document.createElement('div');
    host.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder,
      formats: FORMATS,
      modules: { toolbar: TOOLBAR },
    });
    quillRef.current = quill;

    quill.root.setAttribute('aria-label', ariaLabel);
    quill.on('text-change', (_delta, _old, source) => {
      // 只回報使用者的輸入；程式化寫入不該再觸發一次 onChange。
      if (source === 'user') onChangeRef.current(normaliseHtml(quill.root.innerHTML));
    });

    return () => {
      quillRef.current = null;
      host.innerHTML = '';
    };
    // 只在掛載時建立一次；placeholder / ariaLabel 變動不值得重建編輯器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 受控同步：只有外部值與目前內容不同時才覆寫，避免打斷輸入與游標位置。
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    if (normaliseHtml(quill.root.innerHTML) === normaliseHtml(value)) return;

    const selection = quill.getSelection();
    quill.setContents(quill.clipboard.convert({ html: value }), 'silent');
    if (selection) {
      const max = quill.getLength() - 1;
      quill.setSelection(Math.min(selection.index, max), 0, 'silent');
    }
  }, [value]);

  return <div ref={hostRef} data-testid="rich-text-editor" />;
}
