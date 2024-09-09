import type { Liff } from "@line/liff";
import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import ProjectList from '../components/ProjectList';
import { Loader } from 'lucide-react';

const Home: NextPage<{ liff: Liff | null; liffError: string | null }> = ({
  liff,
  liffError
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeLiff = async () => {
      if (!liff) {
        setIsLoading(false);
        return;
      }

      if (!liff.isLoggedIn()) {
        await liff.login();
      }

      const url = new URL(window.location.href);
      const projectId = url.searchParams.get('projectId');

      if (projectId) {
        router.push(`/projects/${projectId}`);
      } else {
        setIsLoading(false);
      }
    };

    initializeLiff().catch(error => {
      setIsLoading(false);
    });
  }, [liff, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <title>LIFF App - Donation Projects</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <ProjectList />
        {liffError && (
          <div className="mt-4 p-4 bg-red-900 text-red-100 rounded">
            <p>LIFF initialization error...</p>
            <p>
              <code>{liffError}</code>
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;