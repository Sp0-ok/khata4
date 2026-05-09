import { type ReactNode } from "react";
import { type TxnType } from "@/lib/db";

export function PartyPickerSheet({
  trigger,
  title,
  txnType,
}: {
  trigger: ReactNode;
  title: string;
  txnType: TxnType;
}) {
  void title;
  void txnType;
  return <>{trigger}</>;
}
