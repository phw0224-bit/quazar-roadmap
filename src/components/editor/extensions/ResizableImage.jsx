import { useRef } from 'react';
import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

function ImageResizeView({ node, updateAttributes, selected, editor }) {
  const imgRef = useRef(null);
  const isEditable = editor.isEditable;

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current.offsetWidth;

    const onMouseMove = (e) => {
      const newWidth = Math.max(50, startWidth + (e.clientX - startX));
      imgRef.current.style.width = `${newWidth}px`;
    };
    const onMouseUp = () => {
      updateAttributes({ width: `${imgRef.current.offsetWidth}px` });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <NodeViewWrapper style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}>
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={{
            width: node.attrs.width || 'auto',
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '0.5rem',
            outline: selected ? '2px solid #3b82f6' : 'none',
            outlineOffset: '2px',
          }}
          draggable={false}
        />
        {isEditable && selected && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute', right: -5, bottom: -5,
              width: 14, height: 14,
              background: '#3b82f6', border: '2px solid white',
              borderRadius: '50%', cursor: 'se-resize', zIndex: 10,
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.style.width || el.getAttribute('width') || null,
        renderHTML: attrs => attrs.width ? { style: `width: ${attrs.width}` } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageResizeView);
  },
});

export default ResizableImage;
