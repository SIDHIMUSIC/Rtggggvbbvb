import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getTenantPayLink } from "@/lib/rent/portal-server";
import { errMsg } from "@/lib/utils";

export function CopyPayLink({ tenantId }: { tenantId: number }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      onClick={async () => {
        try {
          const link = await getTenantPayLink({ data: { tenantId } });
          const url = `${window.location.origin}${link.path}`;
          await navigator.clipboard.writeText(url);
          toast.success("Pay link copied — send this to the tenant");
        } catch (e) {
          toast.error(errMsg(e));
        }
      }}
    >
      <Link2 className="size-4" />
      Copy tenant pay link
    </Button>
  );
}
