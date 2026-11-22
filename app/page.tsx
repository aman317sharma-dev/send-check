import { loadScenarioFromDisk } from "@/lib/sources/load-scenario";
import { getScenarioResult } from "@/lib/agent/result-cache";
import Walkthrough from "@/components/Walkthrough";

// Stage 3a look-and-feel check: the frame, the scenario tabs, and steps 5-7
// of Scenario 2, built to files 02 and 03. Steps 1-4 and 8, and the other
// four scenarios, come in stage 3b.
export default async function Home() {
  const fileName = "s2_a_price_is_wrong.json";
  const scenario = loadScenarioFromDisk(fileName);
  const result = await getScenarioResult(fileName);

  return (
    <Walkthrough
      result={result}
      saleStart={scenario.file.shopify_discount.starts_at}
      emailSend={scenario.file.klaviyo_email.scheduled_send_at}
    />
  );
}
