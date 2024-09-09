import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import liff from '@line/liff'

function MyApp({ Component, pageProps }: AppProps) {
  const [liffObject, setLiffObject] = useState<any>(null)
  const [liffError, setLiffError] = useState<string | null>(null)

  useEffect(() => {
    import('@line/liff')
      .then((liff) => liff.default)
      .then((liff) => {
        console.log('LIFF init...')
        liff
          .init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
          .then(() => {
            console.log('LIFF init succeeded.')
            setLiffObject(liff)
          })
          .catch((error: Error) => {
            console.log('LIFF init failed.')
            setLiffError(error.toString())
          })
      })
  }, [])

  if (liffError) return <div>Error: {liffError}</div>
  if (!liffObject) return <div>Loading...</div>

  return <Component {...pageProps} liff={liffObject} />
}

export default MyApp
