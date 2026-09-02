import { NextResponse } from "next/server";

import { PersonEditError, updatePersonFromManualEdit } from "@/application/people/person-edit-service";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";

interface RouteContext { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: RouteContext) {
  if (!isPrivateLibraryConfigured()) {
    return NextResponse.json({ error: "Demo library is read-only." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const result = await updatePersonFromManualEdit(libraryRepository, id, await request.json());
    return NextResponse.json({
      personId: result.person.id,
      changedFields: result.changedFields,
      receiptId: result.receipt?.id ?? null,
    });
  } catch (error) {
    if (error instanceof PersonEditError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "person_edit_failed" }, { status: 500 });
  }
}
