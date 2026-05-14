import { Plus, Barcode } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * ItemInputForm - Form for adding/editing bill line items
 * 
 * @param {Object} props
 * @param {string} props.barcode - Barcode input value
 * @param {string} props.qty - Quantity input value
 * @param {string} props.price - Price input value
 * @param {string} props.discount - Discount input value
 * @param {number|null} props.editingIndex - Index being edited, or null for new items
 * @param {Object} props.refs - Refs for focus management {barcodeRef, qtyRef, priceRef, discountRef}
 * @param {Function} props.onChange - Callback(fieldName, value) for input changes
 * @param {Function} props.onAdd - Callback to add/update item
 * @param {Function} props.onOpenScanner - Callback to open barcode scanner
 * @param {Function} props.onKeyNav - Callback(e, nextRefName) for Enter key navigation
 */
export default function ItemInputForm({
  barcode,
  qty,
  price,
  discount,
  editingIndex,
  refs,
  onChange,
  onAdd,
  onOpenScanner,
  onKeyNav
}) {
  const isEditing = editingIndex !== null;

  const handleKeyDown = (e, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "barcode") refs.qtyRef.current?.focus();
      else if (field === "qty") refs.priceRef.current?.focus();
      else if (field === "price") refs.discountRef.current?.focus();
      else if (field === "discount") onAdd();
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-6 gap-4 p-1">
      {/* Barcode with scanner button */}
      <div className="relative col-span-2 sm:col-span-2 space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Barcode / Item No.</label>
        <div className="relative group">
          <Input
            ref={refs.barcodeRef}
            data-testid="barcode-input"
            value={barcode}
            onChange={(e) => onChange('barcode', e.target.value)}
            placeholder="Scan or type..."
            maxLength={60}
            className="pr-12 h-11 font-mono font-bold"
            onKeyDown={(e) => handleKeyDown(e, 'barcode')}
          />
          <button
            data-testid="scan-barcode-btn"
            onClick={onOpenScanner}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-primary hover:bg-primary/10 rounded-lg active:scale-90 transition-all"
            title="Scan with camera"
            type="button"
          >
            <Barcode size={22} weight="duotone" />
          </button>
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Qty (m)</label>
        <Input
          ref={refs.qtyRef}
          data-testid="qty-input"
          value={qty}
          onChange={(e) => onChange('qty', e.target.value)}
          placeholder="0.0"
          type="number"
          step="0.1"
          min="0"
          inputMode="decimal"
          className="h-11 font-mono font-bold"
          onKeyDown={(e) => handleKeyDown(e, 'qty')}
        />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Price/m</label>
        <Input
          ref={refs.priceRef}
          data-testid="price-input"
          value={price}
          onChange={(e) => onChange('price', e.target.value)}
          placeholder="0"
          type="number"
          min="0"
          inputMode="decimal"
          className="h-11 font-mono font-bold"
          onKeyDown={(e) => handleKeyDown(e, 'price')}
        />
      </div>

      {/* Discount */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Disc %</label>
        <Input
          ref={refs.discountRef}
          data-testid="discount-input"
          value={discount}
          onChange={(e) => onChange('discount', e.target.value)}
          placeholder="0"
          type="number"
          min="0"
          max="100"
          inputMode="decimal"
          className="h-11 font-mono font-bold text-destructive"
          onKeyDown={(e) => handleKeyDown(e, 'discount')}
        />
      </div>

      {/* Add/Update Button */}
      <div className="col-span-2 sm:col-span-1 flex items-end">
        <Button
          data-testid="add-item-btn"
          onClick={onAdd}
          disabled={!barcode || !qty || !price}
          className="w-full h-11 font-black uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
          type="button"
        >
          {isEditing ? 'Update' : <><Plus size={18} weight="bold" /> Add</>}
        </Button>
      </div>
    </div>
  );
}
