import "./globals.css";
import Nav from "@/components/Nav";
import ScrollReveal from "@/components/ScrollReveal";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata();

// Set the mode before paint so there is no flash of the wrong theme.
const modeScript = `(function(){try{var m=localStorage.getItem('mode');if(!m){m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-mode',m);}catch(e){document.documentElement.setAttribute('data-mode','light');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: modeScript }} />
      </head>
      <body>
        <Nav />
        <a id="top" />
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
