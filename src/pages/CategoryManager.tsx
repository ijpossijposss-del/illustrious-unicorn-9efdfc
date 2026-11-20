import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';

export default function CategoryManager() {
  const categories = useStore((state) => state.categories);
  const setCategories = useStore((state) => state.setCategories);
  const reorderCategories = useStore((state) => state.reorderCategories);
  const currentUser = useStore((state) => state.currentUser);
  const [newCategory, setNewCategory] = useState('');
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const canManageCategories = currentUser?.role === 'admin';

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      toast.error('Enter a category name');
      return;
    }
    if (categories.includes(trimmed)) {
      toast.error('Category already exists');
      return;
    }
    setCategories([...categories, trimmed]);
    setNewCategory('');
    toast.success('Category added');
  };

  const handleRemoveCategory = (category: string) => {
    setCategories(categories.filter((item) => item !== category));
    toast.success('Category removed');
  };

  const moveCategory = (targetCategory: string) => {
    if (!draggedCategory || draggedCategory === targetCategory) return;
    const next = [...categories];
    const fromIndex = next.indexOf(draggedCategory);
    const toIndex = next.indexOf(targetCategory);
    if (fromIndex < 0 || toIndex < 0) return;
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedCategory);
    reorderCategories(next);
    setDraggedCategory(null);
    setDragOverCategory(null);
    toast.success('POS category order saved');
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Category Manager</h1>
            <p className="section-description">Arrange the category buttons used in POS. Drag categories into the order your branch should use.</p>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 24 }}>
          {canManageCategories && <div className="field-grid" style={{ maxWidth: 420 }}>
            <label className="form-field">
              <span>New category</span>
              <input className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Enter category name" />
            </label>
            <button className="btn" onClick={handleAddCategory}>Add category</button>
          </div>}

          <div className="category-order-list" aria-label="POS category order">
            {categories.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No categories defined yet.</div>
            ) : (
              categories.map((category, index) => (
                <div
                  key={category}
                  className={`category-order-item${dragOverCategory === category ? ' drag-over' : ''}`}
                  draggable
                  onDragStart={() => setDraggedCategory(category)}
                  onDragOver={(event) => { event.preventDefault(); setDragOverCategory(category); }}
                  onDragLeave={() => setDragOverCategory(null)}
                  onDrop={() => moveCategory(category)}
                  onDragEnd={() => { setDraggedCategory(null); setDragOverCategory(null); }}
                >
                  <span className="category-drag-handle" aria-hidden="true">⠿</span>
                  <strong>{index + 1}</strong>
                  <span>{category}</span>
                  {canManageCategories && <button className="btn secondary" onClick={() => { if (window.confirm(`Delete category ${category}? This cannot be undone.`)) handleRemoveCategory(category); }}>Delete</button>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
