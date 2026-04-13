import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Hr,
} from '@react-email/components'
import * as React from 'react'

interface PieceApprovedEmailProps {
  artisanName: string
  pieceTitle: string
  pieceUrl: string
}

export function PieceApprovedEmail({
  artisanName,
  pieceTitle,
  pieceUrl,
}: PieceApprovedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#fafafa' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>
          <Text style={{ fontSize: '18px', fontWeight: 600, color: '#18181b' }}>
            Tu pieza fue aprobada
          </Text>
          <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
            Hola {artisanName},
          </Text>
          <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
            Tu pieza &quot;{pieceTitle}&quot; ha sido aprobada y ya es visible en el catalogo de Crisol.
          </Text>
          <Button
            href={pieceUrl}
            style={{
              display: 'inline-block',
              backgroundColor: '#18181b',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              padding: '10px 20px',
              borderRadius: '8px',
              textDecoration: 'none',
            }}
          >
            Ver pieza en catalogo
          </Button>
          <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#a1a1aa' }}>
            Crisol - Joyeria artesanal
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PieceApprovedEmail
