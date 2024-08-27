import type { Liff } from "@line/liff";
import type { NextPage } from "next";
import Head from "next/head";
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import ProjectList from '../components/ProjectList';

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
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Head>
        <title>LIFF App - Donation Projects</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Donation Projects</h1>
          <ProjectList />
        </div>
        {liffError && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
            <p>LIFF init failed.</p>
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
