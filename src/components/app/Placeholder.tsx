import { Card, CardContent } from "@/components/ui/card";

export function Placeholder({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground py-16 text-center text-sm">{text}</CardContent>
    </Card>
  );
}
