import { Bounty as PrismaBounty } from "@prisma/client";
import { Field, ID, ObjectType } from "type-graphql";

@ObjectType()
export class Bounty implements PrismaBounty {
    @Field(() => ID)
    id: string;

    createdAt: Date;

    updatedAt: Date;

    @Field(() => Boolean, { name: "public" })
    isPublic: boolean;

    @Field(() => String, { name: "publicCode", nullable: true })
    publicCode(): string | null {
        if (this.isPublic) {
            return this.claimCode;
        }
        return null;
    }

    @Field(() => [String], {nullable: true})
    claimedByIp: string[];

    claimCode: string;

    @Field(() => String, { nullable: true })
    maxClaim: number | null;

    @Field(() => String, { nullable: true})
    bountyClaim: number | null;

    isActive: boolean;

    isRandom: boolean;

    fkTrackId: string;
}


// new type to track which user claimed the bounty
@ObjectType()
export class BountyClaim {
    @Field(() => ID)
    id: string;

    @Field(() => Date)
    claimedAt: Date;

    @Field(() => String)
    fkUserId: string;

    @Field(() => String)
    fkBountyId: string;
}
