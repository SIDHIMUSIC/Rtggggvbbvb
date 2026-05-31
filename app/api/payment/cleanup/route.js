import { connectDB } from "../../../../lib/mongodb";
import Payment from "../../../../models/Payment";

export async function GET() {
  await connectDB();

  const all = await Payment.find();
  const map = {};

  for (let p of all) {
    const key = p.tenant + "_" + p.month;

    if (map[key]) {
      await Payment.findByIdAndDelete(p._id);
    } else {
      map[key] = true;
    }
  }

  return Response.json({ message: "Cleaned ✅" });
}
