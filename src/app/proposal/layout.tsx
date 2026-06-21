// Standalone layout for the proposal/engagement document (the [token] view and
// the confirm/[ctoken] step). No marketing Navbar/Footer — a signing surface
// should stand on its own. Just a flex-1 main so the card fills the flex-col
// <body> from the root layout. The brand logo lives in the document header
// (ProposalSections.tsx), not here.
export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex-1">{children}</main>;
}
