import type { NextPage } from 'next'
import Head from 'next/head'
import ProjectList from '../components/ProjectList'

const Home: NextPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Donation Projects</title>
        <meta name="description" content="List of donation projects" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="text-3xl font-bold mb-8 text-center">Donation Projects</h1>
      <ProjectList />
    </div>
  )
}

export default Home
