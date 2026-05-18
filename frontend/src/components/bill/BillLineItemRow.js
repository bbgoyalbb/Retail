import { memo } from "react";
import { PencilSimple, Trash, Scissors, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * BillLineItemRow - Displays a single item in the bill with actions
 */
const BillLineItemRow = memo(function BillLineItemRow({ 
  item, 
  index, 
  isEditing, 
  onEdit, 
  onRemove, 
  onOpenTailoring, 
  onOpenAddon 
}) {
  const tailoringActive = item.tailoring?.enabled;
  const addonActive = item.addon?.enabled && item.addon?.items?.length > 0;
  const addonTotal = (item.addon?.items || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  return (
    <div 
      data-testid={`bill-item-row-${index}`}
      className={cn(
        "group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors duration-150",
        isEditing 
          ? "border-primary bg-primary/[0.03] shadow-md ring-1 ring-primary/20" 
          : "border-border/50 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-black/5"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-base font-black text-primary">#{item.barcode}</span>
          {isEditing && (
            <Badge variant="default" className="h-5 px-2 text-[9px] font-black uppercase tracking-widest animate-pulse">
              Editing
            </Badge>
          )}
          {tailoringActive && (
            <Badge variant="outline" className="h-5 px-2 text-[9px] font-black uppercase tracking-widest bg-info/5 text-info border-info/20 gap-1.5">
              <Scissors size={10} weight="bold" /> {item.tailoring.article_type}
            </Badge>
          )}
          {addonActive && (
            <Badge variant="outline" className="h-5 px-2 text-[9px] font-black uppercase tracking-widest bg-success/5 text-success border-success/20 gap-1.5">
              <Plus size={10} weight="bold" /> {item.addon.items.length} Add-on{item.addon.items.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <div className="mt-2 flex items-center gap-x-6 gap-y-1 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-foreground">{item.qty}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Units</span>
            <span className="text-muted-foreground/30 font-light mx-1">×</span>
            <span className="text-sm font-black text-foreground">₹{item.price}</span>
          </div>
          
          {item.discount > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-black border-none bg-destructive/10 text-destructive">
              -{item.discount}%
            </Badge>
          )}
          
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] opacity-60">Subtotal</span>
            <span className="font-mono text-base font-black text-foreground tracking-tighter">₹{item.total.toLocaleString('en-IN')}</span>
          </div>
          
          {addonTotal > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-success uppercase tracking-widest opacity-60">+</span>
              <span className="font-mono text-sm font-black text-success tracking-tighter">₹{addonTotal}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-5 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/30 justify-end">
        <Button
          variant={tailoringActive ? "default" : "outline"}
          size="icon"
          onClick={() => onOpenTailoring(index)}
          className={cn(
            "h-10 w-10 rounded-xl transition-colors duration-150",
            tailoringActive ? "bg-info hover:bg-info/90 shadow-info/20" : "text-muted-foreground hover:text-info hover:bg-info/5 hover:border-info/30"
          )}
          title={tailoringActive ? "Edit Tailoring" : "Add Tailoring"}
        >
          <Scissors size={18} weight={tailoringActive ? "bold" : "regular"} />
        </Button>
        
        <Button
          variant={addonActive ? "default" : "outline"}
          size="icon"
          onClick={() => onOpenAddon(index)}
          className={cn(
            "h-10 w-10 rounded-xl transition-colors duration-150",
            addonActive ? "bg-success hover:bg-success/90 shadow-success/20" : "text-muted-foreground hover:text-success hover:bg-success/5 hover:border-success/30"
          )}
          title={addonActive ? "Edit Add-ons" : "Add Add-ons"}
        >
          <Plus size={18} weight={addonActive ? "bold" : "regular"} />
        </Button>
        
        <Button
          variant={isEditing ? "default" : "outline"}
          size="icon"
          onClick={() => onEdit(index)}
          className={cn(
            "h-10 w-10 rounded-xl transition-colors duration-150",
            isEditing ? "bg-primary shadow-primary/20" : "text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30"
          )}
          title="Edit Details"
        >
          <PencilSimple size={18} weight={isEditing ? "bold" : "regular"} />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onRemove(index)}
          className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/30 transition-colors duration-150"
          title="Remove Article"
        >
          <Trash size={18} />
        </Button>
      </div>
    </div>
  );
});

export default BillLineItemRow;
