import { Arg, Ctx, Mutation, Resolver } from "type-graphql"

import { Context } from "@/schema";

import { Nft } from "@/resolvers/Nft/Nft.type";
import { prisma } from "@/prisma";

@Resolver (() => Nft)
export class NftResolver {

   @Mutation(() => Nft)
   async sendNft(
            @Ctx() { user }: Context,
            @Arg("nftId") nftId: string,
            @Arg("newOwnerId") newOwnerId: string
        ) {

            
            // Vérification de l'existance de l'utilisateur
            if (!user?.id) {
                throw new Error("user not found");
            }
    

            // Vérification de l'existance du NFT et si le NFT est bien en possession de l'utilisateur
            const nft = await prisma.nft.findUnique({where: {id: nftId}})
            if (!nft || nft.fkOwnerId !== user.id ) {
                throw new Error("nft not found or not owned by the user");
            }
            

            // Vérification de l'existance de l'utilisateur destinataire
            const nextOwner = await prisma.user.findUnique({where: {id: newOwnerId}});
            if (!nextOwner) {
                throw new Error("new owner not found");
            }
    

            // Mise à jour du propriétaire du NFT
            const updatedNft = await prisma.nft.update({where: {id: nft.id}, data: {fkOwnerId: newOwnerId}});

    
            return updatedNft;
        }
    }