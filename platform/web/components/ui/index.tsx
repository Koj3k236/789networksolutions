'use client';
import * as React from 'react';
import * as B from './button';import * as C from './card';import * as D from './dialog';import * as I from './input';import * as L from './label';import * as S from './select';import * as T from './table';import * as K from './checkbox';import * as Sk from './skeleton';
// Typed application boundary around the existing shadcn JavaScript primitives.
export const Button=B.Button as React.ComponentType<React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'default'|'outline'|'secondary'|'ghost'|'link'|'destructive';size?:'default'|'sm'|'lg'|'icon';asChild?:boolean}>;
export const Input=I.Input as React.ComponentType<React.InputHTMLAttributes<HTMLInputElement>>;
export const Label=L.Label as React.ComponentType<React.LabelHTMLAttributes<HTMLLabelElement>>;
export const Card=C.Card as React.ComponentType<React.HTMLAttributes<HTMLDivElement>>;
export const Skeleton=Sk.Skeleton as React.ComponentType<React.HTMLAttributes<HTMLDivElement>>;
export const Dialog=D.Dialog;export const DialogTitle=D.DialogTitle as React.ComponentType<React.HTMLAttributes<HTMLHeadingElement>>;export const DialogDescription=D.DialogDescription as React.ComponentType<React.HTMLAttributes<HTMLParagraphElement>>;
export const DialogContent=D.DialogContent as React.ComponentType<React.HTMLAttributes<HTMLDivElement>>;
export const Select=S.Select;export const SelectValue=S.SelectValue;export const SelectContent=S.SelectContent as React.ComponentType<any>;export const SelectTrigger=S.SelectTrigger as React.ComponentType<any>;export const SelectItem=S.SelectItem as React.ComponentType<any>;
export const Checkbox=K.Checkbox as React.ComponentType<any>;
export const Table=T.Table as React.ComponentType<React.TableHTMLAttributes<HTMLTableElement>>;export const TableHeader=T.TableHeader as React.ComponentType<React.HTMLAttributes<HTMLTableSectionElement>>;export const TableBody=T.TableBody as React.ComponentType<React.HTMLAttributes<HTMLTableSectionElement>>;export const TableRow=T.TableRow as React.ComponentType<React.HTMLAttributes<HTMLTableRowElement>>;export const TableHead=T.TableHead as React.ComponentType<React.ThHTMLAttributes<HTMLTableCellElement>>;export const TableCell=T.TableCell as React.ComponentType<React.TdHTMLAttributes<HTMLTableCellElement>>;
