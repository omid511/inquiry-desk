import LeadDetail from "./lead-detail";
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) { return <LeadDetail id={(await params).id} />; }
