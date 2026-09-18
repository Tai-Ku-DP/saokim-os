"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navFor, type ViewerType } from "@/lib/nav";

/**
 * ⌘K — điều hướng + lệnh + hỏi AI.
 * P5 sẽ nối mục "Hỏi AI" vào /api/ai/chat; hiện tại điều hướng là chính.
 */
export function CommandPalette({
  open,
  onOpenChange,
  viewerType,
  onAskAi,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerType: ViewerType;
  onAskAi?: () => void;
}) {
  const router = useRouter();
  const groups = navFor(viewerType);
  const items = groups.flatMap((group) => group.items);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Tìm hoặc ra lệnh" description="Điều hướng, hành động và hỏi AI">
      <CommandInput placeholder="Tìm dự án, file, hoặc ra lệnh…" />
      <CommandList>
        <CommandEmpty>Không tìm thấy.</CommandEmpty>
        <CommandGroup heading="Đi tới">
          {items.map((item) => (
            <CommandItem key={item.href} value={`${item.label} ${item.href}`} onSelect={() => go(item.href)}>
              <item.icon size={14} aria-hidden />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Trợ lý">
          <CommandItem
            value="hỏi ai trợ lý"
            onSelect={() => {
              onOpenChange(false);
              onAskAi?.();
            }}
          >
            <Sparkles size={14} aria-hidden className="text-hot" />
            <span>Hỏi trợ lý AI</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
