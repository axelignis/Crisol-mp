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

interface PieceRejectedEmailProps {
  artisanName: string
  pieceTitle: string
  feedback: string | null
  status: 'changes_requested' | 'rejected'
  editUrl?: string
}

export function PieceRejectedEmail({
  artisanName,
  pieceTitle,
  feedback,
  status,
  editUrl,
}: PieceRejectedEmailProps) {
  const isChangesRequested = status === 'changes_requested'
  const heading = isChangesRequested
    ? 'Cambios solicitados en tu pieza'
    : 'Pieza rechazada'
  const message = isChangesRequested
    ? `Tu pieza "${pieceTitle}" requiere algunos cambios antes de ser publicada.`
    : `Tu pieza "${pieceTitle}" no ha sido aprobada para publicacion.`

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#fafafa' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>
          <Text style={{ fontSize: '18px', fontWeight: 600, color: '#18181b' }}>
            {heading}
          </Text>
          <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
            Hola {artisanName},
          </Text>
          <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
            {message}
          </Text>
          {feedback && (
            <Container
              style={{
                backgroundColor: '#f4f4f5',
                borderRadius: '8px',
                padding: '12px 16px',
                margin: '16px 0',
              }}
            >
              <Text style={{ fontSize: '12px', color: '#71717a', margin: '0 0 4px 0' }}>
                Mensaje del equipo:
              </Text>
              <Text style={{ fontSize: '14px', color: '#3f3f46', margin: 0 }}>
                {feedback}
              </Text>
            </Container>
          )}
          {isChangesRequested && editUrl && (
            <Button
              href={editUrl}
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
              Editar pieza
            </Button>
          )}
          {!isChangesRequested && (
            <Text style={{ fontSize: '14px', color: '#3f3f46' }}>
              Si tienes preguntas, contactanos respondiendo a este correo.
            </Text>
          )}
          <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0' }} />
          <Text style={{ fontSize: '12px', color: '#a1a1aa' }}>
            Crisol - Joyeria artesanal
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function getSubject(status: 'changes_requested' | 'rejected', pieceTitle: string): string {
  return status === 'changes_requested'
    ? `Cambios solicitados - ${pieceTitle}`
    : `Pieza rechazada - ${pieceTitle}`
}

export default PieceRejectedEmail
