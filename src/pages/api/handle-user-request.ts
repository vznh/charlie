// pages/api/handle-user-request
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { AxiosError } from "axios";
import { getCurrentStatus, parseError } from "@/utils/back";

interface InterfaceResponse {
  conversion?: object;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InterfaceResponse>,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Was called with the wrong method." });
  }

  const { request } = req.body;

  if (!request) {
    return res
      .status(602)
      .json({ error: "Request body is missing 'request'." });
  }

  console.error(getCurrentStatus());

  try {
    const response = await axios.post(
      "https://api.cerebras.ai/v1/chat/completions",
      {
        messages: [
          {
            role: "system",
            content: `You are given a request from a user that you have to parse and convert to a JSON object. You do not need to output any error message or any other message except for the JSON object.
                    A strict output would look like:
                    interface CalendarEvent {
                      summary: string; // Most concise summary of event, no abbreviations/stand-fors
                      location: string; // Standalone string
                      description: string; // Concise one-sentence summary of event
                      start: {
                        dateTime: string; // ISO 8601 date-time string representing the start of the event
                        timeZone: string; // IANA time zone string for the event's time zone
                      };
                      end: {
                        dateTime: string; // ISO 8601 date-time string representing the end of the event
                        timeZone: string; // IANA time zone string for the event's time zone
                      };
                      recurrence: {
                        frequency: string; // Recurrence frequency (e.g., "DAILY", "WEEKLY", etc.)
                        daysOfWeek: string[]; // Array of days of the week as strings (e.g., ["MO", "TU"])
                        until: string; // ISO 8601 date string indicating the last date of the recurrence
                      };
                      attendees: {
                        email: string; // Email address of the attendee
                      }[]; // Array of attendee objects, each containing an email property
                      reminders: {
                        useDefault: boolean; // Indicator whether to use default reminders
                        overrides: {
                          method: string; // Notification method (e.g., "email", "popup")
                          minutes: number; // Number of minutes before the event to send the reminder
                        }[]; // Array of reminder override objects
                      };
                    }

                    You are also to notice abbreviations and interpret: examples would be mwf: Monday, Wednesday, Friday; and mo: month, yr: year, hr: hr, etc... And all descriptions will be one concise sentence long. Only include an organized title for the calendar entry, with no abbreviations unless strictly needed. It's okay to leave fields empty if not explicitly given.`,
          },
          {
            role: "assistant",
            content: `String to convert to JSON object for processing: ${request}, and strictly current date and time of request: ${getCurrentStatus()}`,
          },
        ],
        model: "llama3.1-8b",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.CLOUD_CELEBRAS_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status === 200) {
      const parsedResponse = response.data.choices[0].message.content;
      console.log(parsedResponse);
      return res.status(200).json({ conversion: parsedResponse });
    }
  } catch (error: Error | AxiosError | unknown) {
    return res
      .status(601)
      .json({
        error: `The request was successful, but Celebras did not return a valid response in order to create an event. A detailed error message: ${parseError(error)}`,
      });
  }

  return res
    .status(601)
    .json({
      error: `The request was successful, but Celebras did not return a valid response in order to create an event.`,
    });
}
