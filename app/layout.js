import './globals.css';

export const metadata = {
  title:       'GCR Contacts — NU FAST Islamabad',
  description: 'Instantly find emails of your instructors, TAs, and Lab Demonstrators from your Google Classroom courses.',
  keywords:    'FAST NUCES, NU, GCR, Google Classroom, faculty email, TA email',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
